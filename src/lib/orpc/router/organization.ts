import { ORPCError } from "@orpc/server";
import { count, eq, getColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	checkManyPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { client } from "@/lib/orpc/orpc";

export const listOrganizations = authed.organization.list.handler(
	async ({ input }) => {
		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getColumns(dbSchema.organization) })
				.from(dbSchema.organization)
				/* .where(inArray(dbSchema.organization.id, entityIds)) */
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(dbSchema.organization),
			/* .where(inArray(dbSchema.organization.id, entityIds)) */
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
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getColumns(dbSchema.organization) })
			.from(dbSchema.organization)
			.where(eq(dbSchema.organization.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
		}

		return { data: query };
	});

export const createOrganization = authed.organization.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [newOrganization] = await db
			.insert(dbSchema.organization)
			.values({ ...input, createdAt: new Date() })
			.returning({ ...getColumns(dbSchema.organization) });

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
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.update(dbSchema.organization)
			.set(input)
			.where(eq(dbSchema.organization.id, input.id))
			.returning({ ...getColumns(dbSchema.organization) });

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
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) => {
		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No organizations to delete" };
		}

		try {
			await db
				.delete(dbSchema.organization)
				.where(inArray(dbSchema.organization.id, context.allowedIds));

			return { success: true, message: "Organizations deleted successfully" };
		} catch {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organizations",
			});
		}
	});
