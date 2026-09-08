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
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";
import {
	assertAdminRemainsAfterRemoving,
	assertCanManageOrganizationAdmins,
	countRemovedAdmins,
	organizationRoleRequiresAdminControl,
} from "./helpers/organization-role-policy";

export const listOrganizationMembers = authed.organizationMember.list
	.use(
		requireEntityPermission("organization", "read", {
			entityId: "organizationId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [data, [rowCount]] = yield* Effect.all(
			[
				db.query.member.findMany({
					where: {
						organizationId: {
							eq: input.organizationId,
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
					.where(eq(dbSchema.member.organizationId, input.organizationId)),
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

export const findOrganizationMember = authed.organizationMember.find
	.use(
		requireEntityPermission("organization", "read", {
			entityId: "organizationId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

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
								eq: input.organizationId,
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

export const updateOrganizationMember = authed.organizationMember.update
	.use(
		requireEntityPermission("organization", "manage_members", {
			entityId: "organizationId",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

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
							eq(dbSchema.member.organizationId, input.organizationId),
							eq(dbSchema.member.userId, input.userId),
						),
					)
					.limit(1);

				if (!existing) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							message: "Member not found",
							data: {
								organizationId: input.organizationId,
								userId: input.userId,
							},
						}),
					);
				}

				if (
					organizationRoleRequiresAdminControl(existing.role) ||
					organizationRoleRequiresAdminControl(input.role)
				) {
					yield* assertCanManageOrganizationAdmins({
						organizationId: input.organizationId,
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
								eq(dbSchema.member.organizationId, input.organizationId),
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
							eq(dbSchema.member.organizationId, input.organizationId),
							eq(dbSchema.member.userId, input.userId),
						),
					)
					.returning({
						...getColumns(dbSchema.member),
					});

				if (!member) {
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							message: "Member not found",
							data: {
								organizationId: input.organizationId,
								userId: input.userId,
							},
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
					message: "Member not found",
					data: {
						organizationId: input.organizationId,
						userId: input.userId,
					},
				}),
			);
		}

		if (existing && existing.role !== member.role)
			yield* syncRelationshipTransition({
				resourceType: "organization",
				resourceId: input.organizationId,
				subjectType: "user",
				subjectId: input.userId,
				oldRelation: existing.role,
				newRelation: member.role,
			});

		return {
			data: member,
		};
	});

export const deleteOrganizationMembers = authed.organizationMember.delete
	.use(
		checkManyPermissionMiddleware("organization").adaptInput(
			(input): CheckManyPermissionInputFor<"organization"> => ({
				entityIds: [
					input.organizationId,
				],
				permission: "manage_members",
			}),
		),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
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
							eq(dbSchema.member.organizationId, input.organizationId),
							inArray(dbSchema.member.userId, userIds),
						),
					);

				const removedAdminCount = countRemovedAdmins({
					members: existingMembers,
				});
				if (removedAdminCount > 0) {
					yield* assertCanManageOrganizationAdmins({
						organizationId: input.organizationId,
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
								eq(dbSchema.member.organizationId, input.organizationId),
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
							eq(dbSchema.member.organizationId, input.organizationId),
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
								eq(dbSchema.session.activeOrganizationId, input.organizationId),
							),
						);
				}

				const detached = yield* detachOrganizationAccess({
					tx,
					organizationId: input.organizationId,
					userIds: existingMembers.map((member) => member.userId),
					now,
				});

				return yield* enqueueRelationshipMutations({
					tx,
					mutations: [
						...existingMembers.map((member) => ({
							resourceType: "organization" as const,
							resourceId: input.organizationId,
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
