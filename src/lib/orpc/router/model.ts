import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import type { Capability } from "@/lib/orpc/schemas/capability";
import type { Model } from "@/lib/orpc/schemas/model";

export const listModels = authed.model.list.handler(async ({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const models =
				input.capabilities && input.capabilities.length > 0
					? yield* db
							.select({ ...getColumns(dbSchema.model) })
							.from(dbSchema.model)
							.innerJoin(
								dbSchema.modelCapability,
								eq(dbSchema.modelCapability.modelId, dbSchema.model.id),
							)
							.where(
								and(
									eq(dbSchema.model.providerSlug, input.providerSlug),
									inArray(
										dbSchema.modelCapability.capability,
										input.capabilities,
									),
								),
							)
							.groupBy(dbSchema.model.id)
							.having(
								sql`COUNT(DISTINCT ${dbSchema.modelCapability.capability}) = ${input.capabilities.length}`,
							)
					: yield* db.query.model.findMany({
							where: {
								providerSlug: input.providerSlug,
							},
						});

			if (models.length === 0) {
				return { data: [] };
			}

			const capabilityRows = (yield* db
				.select({
					modelId: dbSchema.modelCapability.modelId,
					...getColumns(dbSchema.capability),
				})
				.from(dbSchema.modelCapability)
				.innerJoin(
					dbSchema.capability,
					eq(
						dbSchema.modelCapability.capability,
						dbSchema.capability.capability,
					),
				)
				.where(
					inArray(
						dbSchema.modelCapability.modelId,
						models.map((model) => model.id),
					),
				)) as (Capability & { modelId: Model["id"] })[];

			const capabilitiesByModel = new Map<Model["id"], Capability[]>();

			for (const capabilityRow of capabilityRows) {
				const capabilities =
					capabilitiesByModel.get(capabilityRow.modelId) ?? [];
				capabilities.push({
					capability: capabilityRow.capability,
					name: capabilityRow.name,
					description: capabilityRow.description,
				});
				capabilitiesByModel.set(capabilityRow.modelId, capabilities);
			}

			return {
				data: models.map((model) => ({
					...model,
					capabilities: capabilitiesByModel.get(model.id) ?? [],
				})),
			};
		}),
	),
);

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
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const model = yield* db.query.model
					.findFirst({
						where: {
							AND: [
								{
									slug: input.slug,
								},
								{
									providerSlug: input.providerSlug,
								},
							],
						},
					})
					.pipe(
						Effect.flatMap((model) =>
							Effect.fromNullable(model).pipe(
								Effect.orElse(() =>
									Effect.fail(errors.NOT_FOUND({ message: "Model not found" })),
								),
							),
						),
					);

				const capabilities = (yield* db
					.select({ ...getColumns(dbSchema.capability) })
					.from(dbSchema.modelCapability)
					.innerJoin(
						dbSchema.capability,
						eq(
							dbSchema.modelCapability.capability,
							dbSchema.capability.capability,
						),
					)
					.where(
						eq(dbSchema.modelCapability.modelId, model.id),
					)) as Capability[];

				return { data: { ...model, capabilities } };
			}),
		),
	);
