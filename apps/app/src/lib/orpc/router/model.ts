import { listProviderModels } from "@orcai/ai";
import { DB, dbSchema } from "@orcai/db";
import type { ModelCapability, ModelSortKey } from "@orcai/schema";
import { ORPCError } from "@orpc/server";
import {
	and,
	arrayContains,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { providerApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "./helpers/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";
import {
	mapCreateModelInputToModelInsertValues,
	mapUpdateModelInputToModelUpdateValues,
	toModelDto,
	toModelListRowDto,
} from "./mappers/model";

const listModels = authed.model.list
	.use(requireOrganizationPermission("read"))
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
			searchTerm
				? or(
						sql`word_similarity(${searchTerm}, ${dbSchema.model.name}) > 0.2`,
						sql`word_similarity(${searchTerm}, ${dbSchema.provider.name}) > 0.2`,
						ilike(dbSchema.model.name, literalSearch(searchTerm)),
						ilike(dbSchema.provider.name, literalSearch(searchTerm)),
					)
				: undefined,
		].filter((c) => c !== undefined);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderBy = yield* buildOrderBy({
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

		const [data, [rowCount]] = yield* Effect.all(
			[
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
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.model)
					.innerJoin(
						dbSchema.provider,
						eq(dbSchema.provider.id, dbSchema.model.providerId),
					)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: data.map((row) =>
				toModelListRowDto(row, {
					id: row.providerId,
					name: row.providerName,
				}),
			),
			rowCount: rowCount.count,
		};
	});

const findModel = authed.model.find
	.use(requireOrganizationPermission("read"))
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

const createModel = authed.model.create
	.use(requireOrganizationPermission("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [foundProvider] = yield* db
			.select({
				id: dbSchema.provider.id,
			})
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, input.providerId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!foundProvider) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "PROVIDER_NOT_FOUND",
					message: "Provider not found in active organization",
				}),
			);
		}

		const [model] = yield* db
			.insert(dbSchema.model)
			.values(mapCreateModelInputToModelInsertValues(input))
			.returning();

		return {
			data: toModelDto(model),
		};
	});

const updateModel = authed.model.update
	.use(requireOrganizationPermission("manage_models"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [existingModel] = yield* db
			.select({
				id: dbSchema.model.id,
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

		if (!existingModel) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "Model not found",
				}),
			);
		}

		const [model] = yield* db
			.update(dbSchema.model)
			.set(mapUpdateModelInputToModelUpdateValues(input))
			.where(eq(dbSchema.model.id, input.id))
			.returning();

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

const deleteModel = authed.model.delete
	.use(requireOrganizationPermission("manage_models"))
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
	.use(requireOrganizationPermission("manage_models"))
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
				Effect.mapError((cause) => {
					if (cause instanceof ORPCError && cause.code === "FORBIDDEN") {
						return cause;
					}

					if (cause instanceof ORPCError && cause.code === "NOT_FOUND") {
						return new AppErrors.NotFoundError({
							reason: "PROVIDER_NOT_FOUND",
							message: "Failed to find provider",
							cause,
						});
					}

					return new AppErrors.BadRequestError({
						reason: "PROVIDER_NOT_FOUND",
						message: "Failed to find provider",
						cause,
					});
				}),
			);

		const apiKey = yield* providerApiKey(provider.id);
		const discovered = yield* Effect.tryPromise({
			try: () =>
				listProviderModels(provider.kind, {
					apiKey,
					endpoint: provider.endpoint,
				}),
			catch: (cause) =>
				new AppErrors.BadRequestError({
					reason: "PROVIDER_MODELS_FETCH_FAILED",
					message: "Failed to fetch models from provider",
					cause,
				}),
		});

		const modelsToInsert = discovered.map((model) => ({
			...model,
			providerId: input.providerId,
			capabilities: [],
		}));

		const insertedModels =
			modelsToInsert.length === 0
				? []
				: yield* db
						.insert(dbSchema.model)
						.values(modelsToInsert)
						.onConflictDoNothing()
						.returning({
							id: dbSchema.model.id,
						});

		const foundCount = modelsToInsert.length;
		const addedCount = insertedModels.length;
		const alreadyExistedCount = foundCount - addedCount;

		return {
			data: {
				foundCount,
				addedCount,
				alreadyExistedCount,
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
