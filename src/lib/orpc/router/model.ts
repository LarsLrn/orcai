import { ORPCError } from "@orpc/server";
import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { authed } from "@/lib/orpc/implementation/authed";
import type { Capability } from "@/lib/orpc/schemas/capability";
import type { Model } from "@/lib/orpc/schemas/model";

export const listModels = authed.model.list.handler(async ({ input }) => {
	let models: (typeof dbSchema.model.$inferSelect)[];

	// If capabilities are specified, filter models that have those capabilities
	if (input.capabilities && input.capabilities.length > 0) {
		models = await db
			.select({ ...getColumns(dbSchema.model) })
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.modelCapability,
				eq(dbSchema.modelCapability.modelId, dbSchema.model.id),
			)
			.where(
				and(
					eq(dbSchema.model.providerSlug, input.providerSlug),
					inArray(dbSchema.modelCapability.capability, input.capabilities),
				),
			)
			.groupBy(dbSchema.model.id)
			.having(
				sql`COUNT(DISTINCT ${dbSchema.modelCapability.capability}) = ${input.capabilities.length}`,
			);
	} else {
		models = await db
			.select({ ...getColumns(dbSchema.model) })
			.from(dbSchema.model)
			.where(eq(dbSchema.model.providerSlug, input.providerSlug));
	}

	const capabilities = (await db
		.select({
			...getColumns(dbSchema.capability),
			...getColumns(dbSchema.modelCapability),
		})
		.from(dbSchema.capability)
		.innerJoin(
			dbSchema.modelCapability,
			eq(dbSchema.modelCapability.capability, dbSchema.capability.capability),
		)
		.where(
			inArray(
				dbSchema.modelCapability.modelId,
				models.map((m) => m.id),
			),
		)) as (Capability & { modelId: Model["id"] })[];

	return {
		data: models.map((model) => ({
			...model,
			capabilities: capabilities.filter(
				(capability) => capability.modelId === model.id,
			),
		})),
	};
});

export const findModel = authed.model.find
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
		const [model] = await db
			.select({ ...getColumns(dbSchema.model) })
			.from(dbSchema.model)
			.where(
				and(
					eq(dbSchema.model.slug, input.slug),
					eq(dbSchema.model.providerSlug, input.providerSlug),
				),
			);

		const capabilities = (await db
			.select({ ...getColumns(dbSchema.capability) })
			.from(dbSchema.capability)
			.innerJoin(
				dbSchema.capability,
				eq(dbSchema.capability.capability, dbSchema.modelCapability.capability),
			)
			.where(eq(dbSchema.modelCapability.modelId, model.id))) as Capability[];

		if (!model) {
			throw new ORPCError("NOT_FOUND", {
				message: "Model not found",
			});
		}

		return { data: { ...model, capabilities } };
	});
