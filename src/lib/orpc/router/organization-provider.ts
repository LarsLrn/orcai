import { ORPCError } from "@orpc/server";
import { and, count, eq, getColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { encryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

export const listOrganizationProviders = authed.organizationProvider.list
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getColumns(dbSchema.organizationProvider) })
				.from(dbSchema.organizationProvider)
				.where(
					eq(
						dbSchema.organizationProvider.organizationId,
						context.auth.session.activeOrganizationId,
					),
				)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(dbSchema.organizationProvider)
				.where(
					eq(
						dbSchema.organizationProvider.organizationId,
						context.auth.session.activeOrganizationId,
					),
				),
		]);

		return { data, rowCount: rowCount.count };
	});

export const findOrganizationProvider = authed.organizationProvider.find
	.use(requireActiveOrganizationMiddleware)
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input, context }) => {
		const [organizationProvider] = await db
			.select({ ...getColumns(dbSchema.organizationProvider) })
			.from(dbSchema.organizationProvider)
			.where(
				and(
					eq(dbSchema.organizationProvider.providerSlug, input.providerSlug),
					eq(
						dbSchema.organizationProvider.organizationId,
						context.auth.session.activeOrganizationId,
					),
				),
			);

		if (!organizationProvider) {
			throw new ORPCError("NOT_FOUND", {
				message: "Organization provider not found",
			});
		}

		return { data: organizationProvider };
	});

export const createOrganizationProvider = authed.organizationProvider.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		// Encrypt the plain text API key received from frontend
		const apiKeyEncrypted = await encryptApiKey(input.apiKey);

		// Remove the plain text apiKey from input and add the encrypted version
		const { apiKey: _, ...inputWithoutApiKey } = input;

		const [query] = await db
			.insert(dbSchema.organizationProvider)
			.values({
				...inputWithoutApiKey,
				organizationId: context.auth.session.activeOrganizationId,
				apiKeyEncrypted,
				createdAt: new Date(),
			})
			.returning({ ...getColumns(dbSchema.organizationProvider) });

		return { data: query };
	});

export const updateOrganizationProvider = authed.organizationProvider.update
	.use(requireActiveOrganizationMiddleware)
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input, context }) => {
		// Prepare the update data
		let updateData: any = { ...input };

		// If apiKey is provided, encrypt it and replace with apiKeyEncrypted
		if (input.apiKey) {
			const { apiKey: _, ...inputWithoutApiKey } = input;
			updateData = {
				...inputWithoutApiKey,
				apiKeyEncrypted: await encryptApiKey(input.apiKey),
			};
		}

		const [query] = await db
			.update(dbSchema.organizationProvider)
			.set(updateData)
			.where(
				and(
					eq(
						dbSchema.organizationProvider.organizationId,
						context.auth.session.activeOrganizationId,
					),
					eq(dbSchema.organizationProvider.providerSlug, input.providerSlug),
				),
			)
			.returning({ ...getColumns(dbSchema.organizationProvider) });

		return { data: query };
	});

export const deleteOrganizationProviders = authed.organizationProvider.delete
	.use(requireActiveOrganizationMiddleware)
	/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.userId),
				action: "delete",
				entityType: "organization",
			}) satisfies CheckManyPermissionInput,
	) */
	.handler(async ({ input, context }) => {
		/* 
		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No organization members to delete" };
		} */

		try {
			await db.delete(dbSchema.organizationProvider).where(
				and(
					eq(
						dbSchema.organizationProvider.organizationId,
						context.auth.session.activeOrganizationId,
					),
					inArray(
						dbSchema.organizationProvider.providerSlug,
						input.refs.map((ref) => ref.providerSlug),
					),
				),
			);

			return {
				success: true,
				message: "Organization providers deleted successfully",
			};
		} catch {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete organization providers",
			});
		}
	});
