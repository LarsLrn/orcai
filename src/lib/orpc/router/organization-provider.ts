import { ORPCError } from "@orpc/server";
import { and, count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { organizationProviderTable } from "@/db/schema/model";
import { authed } from "@/lib/orpc";
import { retry } from "@/lib/orpc/middlewares/retry";

export const listOrganizationProviders = authed.organizationProvider.list
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		/* const { entityIds } = await listAllowedEntities({
      entityType: "organization",
      action: "read",
      userId: context.auth.user.id,
    }); */

		const query = await db
			.select({ ...getTableColumns(organizationProviderTable) })
			.from(organizationProviderTable)
			/* .where(inArray(organization.id, entityIds)) */
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db
			.select({ count: count() })
			.from(organizationProviderTable);

		return { data: query, rowCount: rowCount.count };
	});

export const findOrganizationProvider = authed.organizationProvider.find
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) as const,
  ) */
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(organizationProviderTable) })
			.from(organizationProviderTable)
			.where(
				and(
					eq(organizationProviderTable.providerSlug, input.providerSlug),
					eq(organizationProviderTable.organizationId, input.organizationId),
				),
			);

		if (!query) {
			throw new ORPCError("NOT_FOUND", {
				message: "Organization provider not found",
			});
		}

		return { data: query };
	});

export const createOrganizationProvider = authed.organizationProvider.create
	/* .use(requireActiveOrganizationMiddleware) */
	.handler(async ({ input }) => {
		const [query] = await db
			.insert(organizationProviderTable)
			.values({ ...input, createdAt: new Date() })
			.returning({ ...getTableColumns(organizationProviderTable) });

		/* await createRelation({
			entityId: query.,
			entityType: "organization",
			userId: context.auth.user.id,
			relation: "owner",
		}); */

		return { data: query };
	});

export const updateOrganizationProvider = authed.organizationProvider.update
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
			.update(organizationProviderTable)
			.set(input)
			.where(
				and(
					eq(organizationProviderTable.organizationId, input.organizationId),
					eq(organizationProviderTable.providerSlug, input.providerSlug),
				),
			)
			.returning({ ...getTableColumns(organizationProviderTable) });

		return { data: query };
	});

export const deleteOrganizationProviders = authed.organizationProvider.delete
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
			await db.delete(organizationProviderTable).where(
				and(
					eq(organizationProviderTable.organizationId, input.organizationId),
					inArray(
						organizationProviderTable.providerSlug,
						input.refs.map((ref) => ref.providerSlug),
					),
				),
			);

			return {
				success: true,
				message: "Organization providers deleted successfully",
			};
		} catch (error) {
			console.error("Error deleting organization providers:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organization providers",
			});
		}
	});
