import { DB, dbSchema } from "@orcai/db";
import type { ModelCapability, ModelSortKey } from "@orcai/schema";
import { call } from "@orpc/server";
import {
	and,
	arrayOverlaps,
	count,
	desc,
	eq,
	exists,
	getColumns,
	ilike,
	inArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import OpenAI from "openai";
import * as AppErrors from "@/lib/effect/utils/errors";
import { decryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";
import {
	mapCreateModelInputToModelInsertValues,
	mapUpdateModelInputToModelUpdateValues,
	toModelDto,
} from "./mappers/model";
import { findProvider } from "./provider";

export const listModels = authed.model.list
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const searchTerm = input.filters?.search;

		const conditions = [
			exists(
				db
					.select({
						id: dbSchema.provider.id,
					})
					.from(dbSchema.provider)
					.where(
						and(
							eq(dbSchema.provider.id, dbSchema.model.providerId),
							eq(dbSchema.provider.organizationId, organizationId),
						),
					),
			),
			input.filters?.providerId
				? eq(dbSchema.model.providerId, input.filters.providerId)
				: undefined,
			input.filters?.capabilities
				? arrayOverlaps(
						dbSchema.model.capabilities,
						input.filters.capabilities as ModelCapability[],
					)
				: undefined,
			searchTerm
				? or(
						sql`word_similarity(${searchTerm}, ${dbSchema.model.name}) > 0.2`,
						ilike(dbSchema.model.name, `%${searchTerm}%`),
					)
				: undefined,
		].filter((c) => c !== undefined);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.model.name,
				providerId: dbSchema.model.providerId,
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

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select()
					.from(dbSchema.model)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.model)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: data.map(toModelDto),
			rowCount: rowCount.count,
		};
	});

export const findModel = authed.model.find
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
					message: "Model not found",
				}),
			);
		}

		return {
			data: toModelDto(model),
		};
	});

export const createModel = authed.model.create
	.use(requireOrganizationPermission("manage_members"))
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

export const updateModel = authed.model.update
	.use(requireOrganizationPermission("manage_members"))
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
					message: "Model not found",
				}),
			);
		}

		return {
			data: toModelDto(model),
		};
	});

export const deleteModel = authed.model.delete
	.use(requireOrganizationPermission("manage_members"))
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

export const discoverModels = authed.model.discover
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const { data: provider } = yield* Effect.tryPromise({
			try: () =>
				call(
					findProvider,
					{
						id: input.providerId,
					},
					{
						context,
					},
				),
			catch: (cause) =>
				new AppErrors.BadRequestError({
					message: "Failed to find provider",
					cause,
				}),
		});

		const openAiClient = new OpenAI({
			apiKey: yield* decryptApiKey(provider.apiKeyEncrypted),
			baseURL: provider.endpoint,
		});

		const res = yield* Effect.tryPromise({
			try: () => openAiClient.models.list(),
			catch: (cause) =>
				new AppErrors.BadRequestError({
					message: "Failed to fetch models from provider",
					cause,
				}),
		});

		const modelsToInsert = res.data.map((model) => ({
			providerId: input.providerId,
			providerModelId: model.id,
			name: model.id,
			description: `Model ID: ${model.id} | Owned by ${model.owned_by}`,
			capabilities: [
				"text",
			] satisfies ModelCapability[],
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
