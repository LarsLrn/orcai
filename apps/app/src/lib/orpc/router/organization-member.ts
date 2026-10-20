import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, count, eq, getColumns, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { detachOrganizationAccess } from "@/lib/authz/membership-detach";
import { syncRelationshipTransition } from "@/lib/authz/relationship-transition";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import {
	assertAdminRemainsAfterRemoving,
	assertCanManageOrganizationAdmins,
	countRemovedAdmins,
	organizationRoleRequiresAdminControl,
} from "./helpers/organization-role-policy";

const listOrganizationMembers = authed.organizationMember.list
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [data, [rowCount]] = yield* Effect.all(
			[
				db.query.member.findMany({
					where: {
						organizationId: {
							eq: organizationId,
						},
					},
					limit: input.pageSize,
					offset: input.pageIndex * input.pageSize,
				}),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.member)
					.where(eq(dbSchema.member.organizationId, organizationId)),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

const findOrganizationMember = authed.organizationMember.find
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		return yield* db.query.member
			.findFirst({
				where: {
					AND: [
						{
							userId: {
								eq: input.userId,
							},
						},
						{
							organizationId: {
								eq: organizationId,
							},
						},
					],
				},
			})
			.pipe(
				Effect.flatMap((member) =>
					Effect.fromNullishOr(member).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "MEMBER_NOT_FOUND",
									message: "Member not found",
								}),
						),
					),
				),
				Effect.map((member) => ({
					data: member,
				})),
			);
	});

const updateOrganizationMember = authed.organizationMember.update
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const { existing, member } = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				yield* tx.execute(sql`LOCK TABLE "member" IN SHARE ROW EXCLUSIVE MODE`);

				const [existing] = yield* tx
					.select({
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, input.userId),
						),
					)
					.limit(1);

				if (!existing) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "MEMBER_NOT_FOUND",
							id: input.userId,
							message: "Member not found",
						}),
					);
				}

				if (
					organizationRoleRequiresAdminControl(existing.role) ||
					organizationRoleRequiresAdminControl(input.role)
				) {
					yield* assertCanManageOrganizationAdmins({
						organizationId,
						userId: context.auth.user.id,
						zedToken: getZedToken(context),
					});
				}

				if (
					organizationRoleRequiresAdminControl(existing.role) &&
					input.role &&
					!organizationRoleRequiresAdminControl(input.role)
				) {
					const [adminCountResult] = yield* tx
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
							),
						);
					yield* assertAdminRemainsAfterRemoving({
						adminCount: Number(adminCountResult?.count ?? 0),
						removedAdminCount: 1,
					});
				}

				const [member] = yield* tx
					.update(dbSchema.member)
					.set(input)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, input.userId),
						),
					)
					.returning({
						...getColumns(dbSchema.member),
					});

				if (!member) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "MEMBER_NOT_FOUND",
							id: input.userId,
							message: "Member not found",
						}),
					);
				}

				return {
					existing,
					member,
				};
			}),
		);

		if (!member) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MEMBER_NOT_FOUND",
					id: input.userId,
					message: "Member not found",
				}),
			);
		}

		if (existing && existing.role !== member.role)
			yield* syncRelationshipTransition({
				resourceType: "organization",
				resourceId: organizationId,
				subjectType: "user",
				subjectId: input.userId,
				oldRelation: existing.role,
				newRelation: member.role,
			});

		return {
			data: member,
		};
	});

const deleteOrganizationMembers = authed.organizationMember.delete
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const authz = yield* AuthzService;
		const now = new Date();

		const eventId = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				yield* tx.execute(sql`LOCK TABLE "member" IN SHARE ROW EXCLUSIVE MODE`);

				const userIds = input.refs.map((ref) => ref.userId);
				const existingMembers = yield* tx
					.select({
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							inArray(dbSchema.member.userId, userIds),
						),
					);

				const removedAdminCount = countRemovedAdmins({
					members: existingMembers,
				});
				if (removedAdminCount > 0) {
					yield* assertCanManageOrganizationAdmins({
						organizationId,
						userId: context.auth.user.id,
						zedToken: getZedToken(context),
					});

					const [adminCountResult] = yield* tx
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
							),
						);
					yield* assertAdminRemainsAfterRemoving({
						adminCount: Number(adminCountResult?.count ?? 0),
						removedAdminCount,
					});
				}

				yield* tx
					.delete(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							inArray(dbSchema.member.userId, userIds),
						),
					);

				if (existingMembers.length > 0) {
					yield* tx
						.update(dbSchema.session)
						.set({
							activeOrganizationId: null,
						})
						.where(
							and(
								inArray(
									dbSchema.session.userId,
									existingMembers.map((member) => member.userId),
								),
								eq(dbSchema.session.activeOrganizationId, organizationId),
							),
						);
				}

				const detached = yield* detachOrganizationAccess({
					tx,
					organizationId,
					userIds: existingMembers.map((member) => member.userId),
					now,
				});

				return yield* enqueueRelationshipMutations({
					tx,
					mutations: [
						...existingMembers.map((member) => ({
							resourceType: "organization" as const,
							resourceId: organizationId,
							relation: member.role,
							subjectType: "user" as const,
							subjectId: member.userId,
							operation: "delete" as const,
						})),
						...detached,
					],
				});
			}),
		);

		yield* authz
			.deliverRelationshipEvent(eventId)
			.pipe(
				Effect.catch((cause) =>
					Effect.logError(`authz.delivery_failed cause=${String(cause)}`),
				),
			);

		return {
			success: true,
			message: "Organization members deleted successfully",
		};
	});

export const organizationMemberRouter = {
	list: listOrganizationMembers,
	find: findOrganizationMember,
	update: updateOrganizationMember,
	delete: deleteOrganizationMembers,
};
