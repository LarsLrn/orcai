import { and, count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { encryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";

export const listProviders = authed.provider.list
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [data, [rowCount]] = yield* Effect.all(
					[
						db.query.provider.findMany({
							where: {
								organizationId,
							},
							limit: input.pageSize,
							offset: input.pageIndex * input.pageSize,
						}),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.provider)
							.where(eq(dbSchema.provider.organizationId, organizationId)),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data,
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const findProvider = authed.provider.find
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				return yield* db.query.provider
					.findFirst({
						where: {
							AND: [
								{
									id: input.id,
								},
								{
									organizationId,
								},
							],
						},
					})
					.pipe(
						Effect.flatMap((provider) =>
							Effect.fromNullable(provider).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Provider not found",
										}),
									),
								),
							),
						),
						Effect.map((provider) => ({
							data: provider,
						})),
					);
			}),
		),
	);

export const createProvider = authed.provider.create
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);

export const updateProvider = authed.provider.update
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);

export const deleteProviders = authed.provider.delete
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
			}),
		),
	);
