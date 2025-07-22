import { ORPCError } from "@orpc/server";
import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import {
	capabilityTable,
	modelCapabilityTable,
	modelTable,
} from "@/db/schema/model";
import { authed } from "@/lib/orpc";
import { retry } from "@/lib/orpc/middlewares/retry";

export const listModels = authed.model.list
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const models = await db
			.select({ ...getTableColumns(modelTable) })
			.from(modelTable)
			.where(eq(modelTable.providerSlug, input.providerSlug));

		const capabilities = await db
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
			);

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

		const capabilities = await db
			.select({ ...getTableColumns(capabilityTable) })
			.from(capabilityTable)
			.innerJoin(
				capabilityTable,
				eq(capabilityTable.capability, modelCapabilityTable.capability),
			)
			.where(eq(modelCapabilityTable.modelId, model.id));

		if (!model) {
			throw new ORPCError("NOT_FOUND", {
				message: "Model not found",
			});
		}

		return { data: { ...model, capabilities } };
	});
