import { listProviderModels, providerApiKey } from "@orcai/ai";
import {
	isModelProviderKind,
	type OrganizationId,
	type ProviderId,
} from "@orcai/core";
import {
	buildOrderBy,
	DB,
	dbSchema,
	pageOf,
	type SortExpression,
} from "@orcai/db";
import type {
	ModelCapability,
	ModelSortKey,
	UpdateModelInput,
} from "@orcai/schema";
import { ORPCError } from "@orpc/server";
import {
	and,
	arrayContains,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import { listingFailed } from "@/lib/orpc/router/helpers/model-listing";
import { literalSearch } from "@/lib/utils/literal-search";
import {
	mapCreateModelInputToModelInsertValues,
	mapUpdateModelInputToModelUpdateValues,
	toModelDto,
	toModelListRowDto,
} from "./mappers/model";

const listModels = authed.model.list
	.use(requireOrganization("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const searchTerm = input.filters?.search;

		const conditions = [
			eq(dbSchema.provider.organizationId, organizationId),
			input.filters?.providerId
				? eq(dbSchema.model.providerId, input.filters.providerId)
				: undefined,
			input.filters?.isDeprecated === undefined
				? undefined
				: eq(dbSchema.model.isDeprecated, input.filters.isDeprecated),
			input.filters?.providerEnabled === undefined
				? undefined
				: eq(dbSchema.provider.enabled, input.filters.providerEnabled),
			input.filters?.capabilities
				? arrayContains(
						dbSchema.model.capabilities,
						input.filters.capabilities as ModelCapability[],
					)
				: undefined,
			input.filters?.capabilitiesSet === undefined
				? undefined
				: input.filters.capabilitiesSet
					? isNotNull(dbSchema.model.capabilities)
					: isNull(dbSchema.model.capabilities),
			// Within one provider, its name would match every model.
			searchTerm
				? or(
						sql`word_similarity(${searchTerm}, ${dbSchema.model.name}) > 0.2`,
						ilike(dbSchema.model.name, literalSearch(searchTerm)),
						...(input.filters?.providerId
							? []
							: [
									sql`word_similarity(${searchTerm}, ${dbSchema.provider.name}) > 0.2`,
									ilike(dbSchema.provider.name, literalSearch(searchTerm)),
								]),
					)
				: undefined,
		].filter((c) => c !== undefined);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderBy = buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.model.name,
				providerName: dbSchema.provider.name,
				isDeprecated: dbSchema.model.isDeprecated,
				createdAt: dbSchema.model.createdAt,
			} satisfies Record<ModelSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.model.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.model.id,
			},
		});

		const modelColumns = getColumns(dbSchema.model);
		const providerColumns = getColumns(dbSchema.provider);

		const { data, rowCount } = yield* pageOf(
			db
				.select({
					...modelColumns,
					providerName: providerColumns.name,
				})
				.from(dbSchema.model)
				.innerJoin(
					dbSchema.provider,
					eq(dbSchema.provider.id, dbSchema.model.providerId),
				)
				.where(whereClause),
			input,
			orderBy,
		);

		return {
			data: data.map((row) =>
				toModelListRowDto(row, {
					id: row.providerId,
					name: row.providerName,
				}),
			),
			rowCount,
		};
	});

const findModel = authed.model.find
	.use(requireOrganization("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [foundModel] = yield* db
			.select({
				...getColumns(dbSchema.model),
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		const model = foundModel as typeof dbSchema.model.$inferSelect | undefined;

		if (!model) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "Model not found",
				}),
			);
		}

		return {
			data: toModelDto(model),
		};
	});

/** Models belong to one of the organisation's model providers, never to a search provider. */
const requireModelProvider = ({
	organizationId,
	providerId,
}: {
	organizationId: OrganizationId;
	providerId: ProviderId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [provider] = yield* db
			.select({
				kind: dbSchema.provider.kind,
			})
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, providerId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!provider) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "PROVIDER_NOT_FOUND",
					message: "Provider not found in active organization",
				}),
			);
		}
		if (!isModelProviderKind(provider.kind)) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "PROVIDER_PURPOSE_MISMATCH",
					message: "A search provider has no models.",
				}),
			);
		}
	});

const createModel = authed.model.create
	.use(requireOrganization("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		yield* requireModelProvider({
			organizationId,
			providerId: input.providerId,
		});

		const [model] = yield* db
			.insert(dbSchema.model)
			.values(mapCreateModelInputToModelInsertValues(input))
			.returning();

		return {
			data: toModelDto(model),
		};
	});

const updateModel = authed.model.update
	.use(requireOrganization("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		return yield* db.transaction(() =>
			applyModelUpdate(input, context.auth.session.activeOrganizationId),
		);
	});

const applyModelUpdate = (
	input: UpdateModelInput,
	organizationId: OrganizationId,
) =>
	Effect.gen(function* () {
		const db = yield* DB;

		// Pool validation takes this row too, so a move and a pool write apply in turn.
		const [existingModel] = yield* db
			.select({
				id: dbSchema.model.id,
				providerId: dbSchema.model.providerId,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1)
			.for("update", {
				of: dbSchema.model,
			});

		if (!existingModel) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "Model not found",
				}),
			);
		}

		if (input.providerId && input.providerId !== existingModel.providerId) {
			yield* requireModelProvider({
				organizationId,
				providerId: input.providerId,
			});

			const [pool] = yield* db
				.select({
					id: dbSchema.quotaPool.id,
				})
				.from(dbSchema.quotaPool)
				.where(eq(dbSchema.quotaPool.modelId, existingModel.id))
				.limit(1);

			if (pool) {
				return yield* Effect.fail(
					new AppErrors.ConflictError({
						reason: "MODEL_IN_QUOTA_POOLS",
						message:
							"Quota pools limited to this model keep it on its provider",
					}),
				);
			}
		}

		const [model] = yield* db
			.update(dbSchema.model)
			.set(mapUpdateModelInputToModelUpdateValues(input))
			.where(eq(dbSchema.model.id, input.id))
			.returning();

		return {
			data: toModelDto(model),
		};
	});

const deleteModel = authed.model.delete
	.use(requireOrganization("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const modelIds = input.refs.map((ref) => ref.id);

		const providerRows = yield* db
			.select({
				id: dbSchema.provider.id,
			})
			.from(dbSchema.provider)
			.where(eq(dbSchema.provider.organizationId, organizationId));

		const providerIds = providerRows.map((row) => row.id);
		if (providerIds.length === 0) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "One or more models were not found",
				}),
			);
		}

		const existingModels = yield* db
			.select({
				id: dbSchema.model.id,
			})
			.from(dbSchema.model)
			.where(
				and(
					inArray(dbSchema.model.id, modelIds),
					inArray(dbSchema.model.providerId, providerIds),
				),
			);

		if (existingModels.length !== modelIds.length) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "One or more models were not found",
				}),
			);
		}

		yield* db
			.delete(dbSchema.model)
			.where(
				and(
					inArray(dbSchema.model.id, modelIds),
					inArray(dbSchema.model.providerId, providerIds),
				),
			);

		return {
			success: true,
			message: "Models deleted successfully",
		};
	});

const discoverModels = authed.model.discover
	.use(requireOrganization("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const procedures = yield* Procedures;
		const { data: provider } = yield* procedures.provider
			.find(
				{
					id: input.providerId,
				},
				{
					context,
				},
			)
			.pipe(
				Effect.mapError((cause) =>
					cause instanceof ORPCError && cause.code === "NOT_FOUND"
						? new AppErrors.NotFoundError({
								reason: "PROVIDER_NOT_FOUND",
								message: "Failed to find provider",
								cause,
							})
						: cause,
				),
			);

		const { kind } = provider;
		if (!isModelProviderKind(kind)) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "PROVIDER_PURPOSE_MISMATCH",
					message: "A search provider has no models.",
				}),
			);
		}

		const apiKey = yield* providerApiKey(provider.id);
		const discovered = yield* listProviderModels(kind, {
			apiKey,
			endpoint: provider.endpoint,
		}).pipe(
			Effect.mapError(listingFailed("Failed to fetch models from provider")),
		);

		const modelsToInsert = discovered.map((model) => ({
			...model,
			providerId: input.providerId,
		}));

		const { capabilities, contextWindow, maxOutputTokens } = dbSchema.model;
		// Known models only gain what they lack, so edited ones keep theirs.
		const writtenModels =
			modelsToInsert.length === 0
				? []
				: yield* db
						.insert(dbSchema.model)
						.values(modelsToInsert)
						.onConflictDoUpdate({
							target: [
								dbSchema.model.providerModelId,
								dbSchema.model.providerId,
							],
							set: {
								capabilities: sql`coalesce(${capabilities}, excluded.capability)`,
								contextWindow: sql`coalesce(${contextWindow}, excluded.context_window)`,
								maxOutputTokens: sql`coalesce(${maxOutputTokens}, excluded.max_output_tokens)`,
							},
							setWhere: sql`(${capabilities} is null and excluded.capability is not null) or (${contextWindow} is null and excluded.context_window is not null) or (${maxOutputTokens} is null and excluded.max_output_tokens is not null)`,
						})
						.returning({
							// Postgres leaves xmax at 0 on a row the statement inserted.
							inserted: sql<boolean>`xmax = 0`,
							capabilities,
						});

		const foundCount = modelsToInsert.length;
		const addedModels = writtenModels.filter(({ inserted }) => inserted);
		const addedCount = addedModels.length;
		const alreadyExistedCount = foundCount - addedCount;

		return {
			data: {
				foundCount,
				addedCount,
				alreadyExistedCount,
				capabilitiesUnsetCount: addedModels.filter(
					(model) => model.capabilities === null,
				).length,
			},
		};
	});

export const modelRouter = {
	list: listModels,
	create: createModel,
	find: findModel,
	update: updateModel,
	delete: deleteModel,
	discover: discoverModels,
};
