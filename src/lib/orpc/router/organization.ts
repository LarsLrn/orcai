import { getLogger } from "@orpc/experimental-pino";
import { ORPCError } from "@orpc/server";
import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { organization } from "@/db/schema/organization";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { checkManyPermissionMiddleware } from "@/lib/orpc/middlewares/permission";
import { client } from "@/lib/orpc/orpc";

export const listOrganizations = authed.organization.list.handler(
	async ({ input }) => {
		/* const { entityIds } = await listAllowedEntities({
			entityType: "organization",
			action: "read",
			userId: context.auth.user.id,
		}); */

		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getTableColumns(organization) })
				.from(organization)
				/* .where(inArray(organization.id, entityIds)) */
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(organization),
			/* .where(inArray(organization.id, entityIds)) */
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findOrganization = authed.organization.find
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
			.select({ ...getTableColumns(organization) })
			.from(organization)
			.where(eq(organization.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}

		return { data: query };
	});

export const createOrganization = authed.organization.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [newOrganization] = await db
			.insert(organization)
			.values({ ...input, createdAt: new Date() })
			.returning({ ...getTableColumns(organization) });

		const newOrganizationMember = await client.organizationMember.create({
			organizationId: newOrganization.id,
			userId: context.auth.user.id,
			role: "owner",
		});

		return { data: newOrganization, relation: newOrganizationMember };
	});

export const updateOrganization = authed.organization.update
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
			.update(organization)
			.set(input)
			.where(eq(organization.id, input.id))
			.returning({ ...getTableColumns(organization) });

		return { data: query };
	});

export const deleteOrganizations = authed.organization.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "organization",
			}) as const,
	)
	.handler(async ({ context }) => {
		const logger = getLogger(context);
		logger?.info({ ids: context.allowedIds }, "Deleting organizations by IDs");

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No organizations to delete" };
		}

		try {
			await db
				.delete(organization)
				.where(inArray(organization.id, context.allowedIds));

			return { success: true, message: "Organizations deleted successfully" };
		} catch (error) {
			logger?.error({ error }, "Error deleting organizations:");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organizations",
			});
		}
	});
