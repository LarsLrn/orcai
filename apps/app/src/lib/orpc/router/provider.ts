import { DB, dbSchema } from "@orcai/db";
import { and, count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { encryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";

export const listProviders = authed.provider.list
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const countConditions = [
			eq(dbSchema.provider.organizationId, organizationId),
			input.filters?.enabled !== undefined
				? eq(dbSchema.provider.enabled, input.filters.enabled)
				: undefined,
		].filter((condition) => condition !== undefined);
		const providerWhere = {
			AND: [
				{
					organizationId: {
						eq: organizationId,
					},
				},
				input.filters?.enabled !== undefined
					? {
							enabled: input.filters.enabled,
						}
					: undefined,
			].filter((condition) => condition !== undefined),
		};

		const countWhereClause =
			countConditions.length > 0 ? and(...countConditions) : undefined;

		const [data, [rowCount]] = yield* Effect.all(
			[
				db.query.provider.findMany({
					where: providerWhere,
					limit: input.pageSize,
					offset: input.pageIndex * input.pageSize,
				}),
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

export const findProvider = authed.provider.find
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context, errors }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [provider] = yield* db
			.select()
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, input.id),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		return yield* Effect.fromNullishOr(provider).pipe(
			Effect.mapError(() =>
				errors.NOT_FOUND({
					message: "Provider not found",
				}),
			),
			Effect.map((provider) => ({
				data: provider,
			})),
		);
	});

export const createProvider = authed.provider.create
	.use(requireOrganizationPermission("manage_members"))
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

export const updateProvider = authed.provider.update
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context, errors }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const { apiKey, ...inputWithoutApiKey } = input;
		const updateData =
			apiKey === undefined
				? inputWithoutApiKey
				: {
						...inputWithoutApiKey,
						apiKeyEncrypted: yield* encryptApiKey(apiKey),
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
				errors.NOT_FOUND({
					message: "Provider not found",
				}),
			);
		}

		return {
			data: provider,
		};
	});

export const deleteProviders = authed.provider.delete
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		yield* db.delete(dbSchema.provider).where(
			and(
				eq(dbSchema.provider.organizationId, organizationId),
				inArray(
					dbSchema.provider.id,
					input.refs.map((ref) => ref.id),
				),
			),
		);

		return {
			success: true,
			message: "Providers deleted successfully",
		};
	});
