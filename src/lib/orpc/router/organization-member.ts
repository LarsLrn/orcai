import { ORPCError } from "@orpc/server";
import { and, count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { member } from "@/db/schema/organization";
import { authed } from "@/lib/orpc/implementation/authed";
import { createRelation } from "@/lib/spice-db/actions";

export const listOrganizationMembers = authed.organizationMember.list.handler(
	async ({ input }) => {
		/* const { entityIds } = await listAllowedEntities({
      entityType: "organization",
      action: "read",
      userId: context.auth.user.id,
    }); */

		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getTableColumns(member) })
				.from(member)
				/* .where(inArray(organization.id, entityIds)) */
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(member) /* .where(inArray(organization.id, entityIds)) */,
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
      }) as const,
  ) */
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(member) })
			.from(member)
			.where(
				and(
					eq(member.userId, input.userId),
					eq(member.organizationId, input.organizationId),
				),
			);

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Member not found" });
		}

		return { data: query };
	});

export const createOrganizationMember = authed.organizationMember.create
	/* .use(requireActiveOrganizationMiddleware) */
	.handler(async ({ input, context }) => {
		const [query] = await db
			.insert(member)
			.values({ ...input, createdAt: new Date() })
			.returning({ ...getTableColumns(member) });

		await createRelation({
			entityId: query.id,
			entityType: "organization",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return { data: query };
	});

export const updateOrganizationMember = authed.organizationMember.update
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) as const,
  ) */
	.handler(async ({ input }) => {
		const [query] = await db
			.update(member)
			.set(input)
			.where(
				and(
					eq(member.organizationId, input.organizationId),
					eq(member.userId, input.userId),
				),
			)
			.returning({ ...getTableColumns(member) });

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
			}) as const,
	) */
	.handler(async ({ input }) => {
		/* console.log(
			"Deleting organization members with allowed IDs:",
			context.allowedIds,
		);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No organization members to delete" };
		} */

		try {
			await db.delete(member).where(
				and(
					eq(member.organizationId, input.organizationId),
					inArray(
						member.userId,
						input.refs.map((ref) => ref.userId),
					),
				),
			);

			return {
				success: true,
				message: "Organization members deleted successfully",
			};
		} catch (error) {
			console.error("Error deleting organization members:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organization members",
			});
		}
	});
