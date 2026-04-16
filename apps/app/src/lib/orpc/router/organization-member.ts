import { DB, dbSchema } from "@orcai/db";
import { and, count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { syncRelationshipTransition } from "@/lib/authz/relationship-transition";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";

export const listOrganizationMembers = authed.organizationMember.list
	.use(
		...requireEntityPermission("organization", "read", {
			entityId: "organizationId",
		}),
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);

export const findOrganizationMember = authed.organizationMember.find
	.use(
		...requireEntityPermission("organization", "read", {
			entityId: "organizationId",
		}),
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
							Effect.fromNullable(member).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Member not found",
										}),
									),
								),
							),
						),
						Effect.map((member) => ({
							data: member,
						})),
					);
			}),
		),
	);

export const createOrganizationMember = authed.organizationMember.create
	.use(
		...requireEntityPermission("organization", "manage_members", {
			entityId: "organizationId",
		}),
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const member = yield* db
					.insert(dbSchema.member)
					.values({
						...input,
						createdAt: new Date(),
					})
					.returning({
						...getColumns(dbSchema.member),
					})
					.pipe(Effect.map(([member]) => member));

				yield* syncRelationshipTransition({
					resourceType: "organization",
					resourceId: input.organizationId,
					subjectType: "user",
					subjectId: input.userId,
					newRelation: input.role,
				});

				return {
					data: member,
				};
			}),
		),
	);

export const updateOrganizationMember = authed.organizationMember.update
	.use(
		...requireEntityPermission("organization", "manage_members", {
			entityId: "organizationId",
		}),
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [existing] = yield* db
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

				const [member] = yield* db
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
						errors.NOT_FOUND({
							message: "Member not found",
							data: {
								organizationId: input.organizationId,
								userId: input.userId,
							},
						}),
					);
				}

				if (existing && existing.role !== member.role) {
					yield* syncRelationshipTransition({
						resourceType: "organization",
						resourceId: input.organizationId,
						subjectType: "user",
						subjectId: input.userId,
						oldRelation: existing.role,
						newRelation: member.role,
					});
				}

				return {
					data: member,
				};
			}),
		),
	);

export const deleteOrganizationMembers = authed.organizationMember.delete
	.use(
		checkManyPermissionMiddleware("organization"),
		(input): CheckManyPermissionInputFor<"organization"> => ({
			entityIds: [
				input.organizationId,
			],
			permission: "manage_members",
		}),
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const existingMembers = yield* db
					.select({
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, input.organizationId),
							inArray(
								dbSchema.member.userId,
								input.refs.map((ref) => ref.userId),
							),
						),
					);

				yield* db.delete(dbSchema.member).where(
					and(
						eq(dbSchema.member.organizationId, input.organizationId),
						inArray(
							dbSchema.member.userId,
							input.refs.map((ref) => ref.userId),
						),
					),
				);

				if (existingMembers.length > 0) {
					yield* Effect.forEach(
						existingMembers,
						(member) =>
							syncRelationshipTransition({
								resourceType: "organization",
								resourceId: input.organizationId,
								subjectType: "user",
								subjectId: member.userId,
								oldRelation: member.role,
							}),
						{
							concurrency: "unbounded",
						},
					);
				}

				return {
					success: true,
					message: "Organization members deleted successfully",
				};
			}),
		),
	);
