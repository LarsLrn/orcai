import { ORPCError } from "@orpc/server";
import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema/auth";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { checkManyPermissionMiddleware } from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";
import { createRelation } from "@/lib/spice-db/actions";

export const listOrganizations = authed.organization.list
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		/* const { entityIds } = await listAllowedEntities({
			entityType: "organization",
			action: "read",
			userId: context.session.user.id,
		}); */

		const query = await db
			.select({ ...getTableColumns(organization) })
			.from(organization)
			/* .where(inArray(organization.id, entityIds)) */
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db.select({ count: count() }).from(organization);

		return { data: query, rowCount: rowCount.count };
	});

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
	.use(retry({ times: 3 }))
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
		const [query] = await db
			.insert(organization)
			.values(input)
			.returning({ ...getTableColumns(organization) });

		await db.insert(member).values({
			organizationId: query.id,
			userId: context.session.user.id,
			role: "owner",
			createdAt: new Date(),
		});

		await createRelation({
			entityId: query.id,
			entityType: "organization",
			userId: context.session.user.id,
			relation: "owner",
		});

		return { data: query };
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
		console.log("Deleting organizations with allowed IDs:", context.allowedIds);

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
			console.error("Error deleting organizations:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organizations",
			});
		}
	});
