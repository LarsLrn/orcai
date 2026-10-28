import { providerKinds } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type ModelCapability,
	type ProviderSortKey,
	providerFieldIssues,
} from "@orcai/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { encryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

/** Every column a caller may read; the encrypted API key stays server side. */
const providerColumns = {
	id: dbSchema.provider.id,
	organizationId: dbSchema.provider.organizationId,
	name: dbSchema.provider.name,
	description: dbSchema.provider.description,
	endpoint: dbSchema.provider.endpoint,
	kind: dbSchema.provider.kind,
	meteringMode: dbSchema.provider.meteringMode,
	currency: dbSchema.provider.currency,
	reportsCost: dbSchema.provider.reportsCost,
	searchPrice: dbSchema.provider.searchPrice,
	enabled: dbSchema.provider.enabled,
	createdAt: dbSchema.provider.createdAt,
	updatedAt: dbSchema.provider.updatedAt,
};

const listProviders = authed.provider.list
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const countConditions = [
			eq(dbSchema.provider.organizationId, organizationId),
			input.filters?.enabled !== undefined
				? eq(dbSchema.provider.enabled, input.filters.enabled)
				: undefined,
			input.filters?.purpose !== undefined
				? inArray(
						dbSchema.provider.kind,
						providerKinds
							.filter(({ purpose }) => purpose === input.filters?.purpose)
							.map(({ kind }) => kind),
					)
				: undefined,
		].filter((condition) => condition !== undefined);

		const countWhereClause =
			countConditions.length > 0 ? and(...countConditions) : undefined;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.provider.name,
				enabled: dbSchema.provider.enabled,
				meteringMode: dbSchema.provider.meteringMode,
				createdAt: dbSchema.provider.createdAt,
				updatedAt: dbSchema.provider.updatedAt,
			} satisfies Record<ProviderSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.provider.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.provider.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select(providerColumns)
					.from(dbSchema.provider)
					.where(countWhereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.provider)
					.where(countWhereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

const findProvider = authed.provider.find
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [provider] = yield* db
			.select(providerColumns)
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!provider) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					message: "Provider not found",
				}),
			);
		}

		const ofProvider = eq(dbSchema.model.providerId, provider.id);
		const [[counts], capabilities] = yield* Effect.all(
			[
				db
					.select({
						total: count(),
						deprecated: count(
							sql`case when ${dbSchema.model.isDeprecated} then 1 end`,
						),
					})
					.from(dbSchema.model)
					.where(ofProvider),
				db
					.selectDistinct({
						capability: sql<ModelCapability>`unnest(${dbSchema.model.capabilities})`,
					})
					.from(dbSchema.model)
					.where(ofProvider)
					.orderBy(sql`1`),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: {
				...provider,
				models: {
					...counts,
					capabilities: capabilities.map((row) => row.capability),
				},
			},
		};
	});

const createProvider = authed.provider.create
	.use(requireOrganizationPermission("manage_providers"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const apiKeyEncrypted = yield* encryptApiKey(input.apiKey);

		const { apiKey: _apiKey, ...inputWithoutApiKey } = input;

		const [provider] = yield* db
			.insert(dbSchema.provider)
			.values({
				...inputWithoutApiKey,
				organizationId,
				apiKeyEncrypted,
				createdAt: new Date(),
			})
			.returning();

		return {
			data: provider,
		};
	});

const updateProvider = authed.provider.update
	.use(requireOrganizationPermission("manage_providers"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [stored] = yield* db
			.select(providerColumns)
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!stored) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					message: "Provider not found",
				}),
			);
		}
		const [issue] = providerFieldIssues({
			...stored,
			...input,
		});
		if (issue) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: issue[1],
					message: `The ${issue[0]} does not suit the provider`,
				}),
			);
		}

		const { apiKey, ...inputWithoutApiKey } = input;
		const updateData = {
			...inputWithoutApiKey,
			...(apiKey === undefined
				? {}
				: {
						apiKeyEncrypted: yield* encryptApiKey(apiKey),
					}),
			updatedAt: new Date(),
		};

		const [provider] = yield* db
			.update(dbSchema.provider)
			.set(updateData)
			.where(
				and(
					eq(dbSchema.provider.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.returning();

		if (!provider) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					message: "Provider not found",
				}),
			);
		}

		return {
			data: provider,
		};
	});

const deleteProviders = authed.provider.delete
	.use(requireOrganizationPermission("manage_providers"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const providerIds = input.refs.map((ref) => ref.id);

		const existingProviders = yield* db
			.select({
				id: dbSchema.provider.id,
			})
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.organizationId, organizationId),
					inArray(dbSchema.provider.id, providerIds),
				),
			);

		if (existingProviders.length !== providerIds.length) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					message: "One or more providers were not found",
				}),
			);
		}

		// The foreign key clears the provider; the mode must not stay on it.
		yield* db
			.update(dbSchema.organization)
			.set({
				webSearchMode: "off",
			})
			.where(
				and(
					eq(dbSchema.organization.id, organizationId),
					inArray(dbSchema.organization.webSearchProviderId, providerIds),
				),
			);

		yield* db
			.delete(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.organizationId, organizationId),
					inArray(dbSchema.provider.id, providerIds),
				),
			);

		return {
			success: true,
			message: "Providers deleted successfully",
		};
	});

export const providerRouter = {
	list: listProviders,
	create: createProvider,
	find: findProvider,
	update: updateProvider,
	delete: deleteProviders,
};
