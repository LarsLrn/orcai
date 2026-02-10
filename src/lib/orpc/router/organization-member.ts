import { ORPCError } from "@orpc/server";
import { and, count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { createRelation } from "@/lib/spice-db/actions";

export const listOrganizationMembers = authed.organizationMember.list.handler(
	async ({ input }) => {
		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getColumns(dbSchema.member) })
				.from(dbSchema.member)
				/* .where(inArray(organization.id, entityIds)) */
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(
					dbSchema.member,
				) /* .where(inArray(organization.id, entityIds)) */,
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findOrganizationMember = authed.organizationMember.find
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getColumns(dbSchema.member) })
			.from(dbSchema.member)
			.where(
				and(
					eq(dbSchema.member.userId, input.userId),
					eq(dbSchema.member.organizationId, input.organizationId),
				),
			);

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Member not found" });
		}

		return { data: query };
	});

export const createOrganizationMember = authed.organizationMember.create
	/* .use(requireActiveOrganizationMiddleware) */
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const member = yield* db
					.insert(dbSchema.member)
					.values({ ...input, createdAt: new Date() })
					.returning({ ...getColumns(dbSchema.member) })
					.pipe(Effect.map(([member]) => member));

				yield* createRelation({
					entityId: member.id,
					entityType: "organization",
					userId: context.auth.user.id,
					relation: "owner",
				});

				return { data: member };
			}),
		),
	);

export const updateOrganizationMember = authed.organizationMember.update
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input }) => {
		const [query] = await db
			.update(dbSchema.member)
			.set(input)
			.where(
				and(
					eq(dbSchema.member.organizationId, input.organizationId),
					eq(dbSchema.member.userId, input.userId),
				),
			)
			.returning({ ...getColumns(dbSchema.member) });

		return { data: query };
	});

export const deleteOrganizationMembers = authed.organizationMember.delete
	/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.userId),
				action: "delete",
				entityType: "organization",
			}) satisfies CheckManyPermissionInput,
	) */
	.handler(async ({ input }) => {
		/* logger.info(
			{ids: context.allowedIds},
			"Deleting organization members with allowed IDs"
		);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No organization members to delete" };
		} */

		try {
			await db.delete(dbSchema.member).where(
				and(
					eq(dbSchema.member.organizationId, input.organizationId),
					inArray(
						dbSchema.member.userId,
						input.refs.map((ref) => ref.userId),
					),
				),
			);

			return {
				success: true,
				message: "Organization members deleted successfully",
			};
		} catch {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organization members",
			});
		}
	});
