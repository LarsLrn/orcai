import { ORPCError } from "@orpc/server";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import {
	capabilityTable,
	modelCapabilityTable,
	modelTable,
} from "@/db/schema/model";
import { authed } from "@/lib/orpc";
import { retry } from "@/lib/orpc/middlewares/retry";
import type { Capability } from "../schemas/capability";
import type { Model } from "../schemas/model";

export const listModels = authed.model.list
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		let models: (typeof modelTable.$inferSelect)[];

		// If capabilities are specified, filter models that have those capabilities
		if (input.capabilities && input.capabilities.length > 0) {
			models = await db
				.select({ ...getTableColumns(modelTable) })
				.from(modelTable)
				.innerJoin(
					modelCapabilityTable,
					eq(modelCapabilityTable.modelId, modelTable.id),
				)
				.where(
					and(
						eq(modelTable.providerSlug, input.providerSlug),
						inArray(modelCapabilityTable.capability, input.capabilities),
					),
				)
				.groupBy(modelTable.id)
				.having(
					sql`COUNT(DISTINCT ${modelCapabilityTable.capability}) = ${input.capabilities.length}`,
				);
		} else {
			models = await db
				.select({ ...getTableColumns(modelTable) })
				.from(modelTable)
				.where(eq(modelTable.providerSlug, input.providerSlug));
		}

		const capabilities = (await db
			.select({
				...getTableColumns(capabilityTable),
				...getTableColumns(modelCapabilityTable),
			})
			.from(capabilityTable)
			.innerJoin(
				modelCapabilityTable,
				eq(modelCapabilityTable.capability, capabilityTable.capability),
			)
			.where(
				inArray(
					modelCapabilityTable.modelId,
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
      }) as const,
  ) */
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [model] = await db
			.select({ ...getTableColumns(modelTable) })
			.from(modelTable)
			.where(
				and(
					eq(modelTable.slug, input.slug),
					eq(modelTable.providerSlug, input.providerSlug),
				),
			);

		const capabilities = (await db
			.select({ ...getTableColumns(capabilityTable) })
			.from(capabilityTable)
			.innerJoin(
				capabilityTable,
				eq(capabilityTable.capability, modelCapabilityTable.capability),
			)
			.where(eq(modelCapabilityTable.modelId, model.id))) as Capability[];

		if (!model) {
			throw new ORPCError("NOT_FOUND", {
				message: "Model not found",
			});
		}

		return { data: { ...model, capabilities } };
	});
