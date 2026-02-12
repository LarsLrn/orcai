import { and, count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { encryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

export const listOrganizationProviders = authed.organizationProvider.list
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [data, [rowCount]] = yield* Effect.all(
					[
						db.query.organizationProvider.findMany({
							where: {
								organizationId: context.auth.session.activeOrganizationId,
							},
							limit: input.pageSize,
							offset: input.pageIndex * input.pageSize,
						}),
						db
							.select({ count: count() })
							.from(dbSchema.organizationProvider)
							.where(
								eq(
									dbSchema.organizationProvider.organizationId,
									context.auth.session.activeOrganizationId,
								),
							),
					],
					{ concurrency: "unbounded" },
				);

				return { data, rowCount: rowCount.count };
			}),
		),
	);

export const findOrganizationProvider = authed.organizationProvider.find
	.use(requireActiveOrganizationMiddleware)
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.organizationProvider
					.findFirst({
						where: {
							AND: [
								{
									providerSlug: input.providerSlug,
								},
								{
									organizationId: context.auth.session.activeOrganizationId,
								},
							],
						},
					})
					.pipe(
						Effect.flatMap((organizationProvider) =>
							Effect.fromNullable(organizationProvider).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Organization provider not found",
										}),
									),
								),
							),
						),
						Effect.map((organizationProvider) => ({
							data: organizationProvider,
						})),
					);
			}),
		),
	);

export const createOrganizationProvider = authed.organizationProvider.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const apiKeyEncrypted = yield* Effect.promise(() =>
					encryptApiKey(input.apiKey),
				);

				const { apiKey: _apiKey, ...inputWithoutApiKey } = input;

				const [organizationProvider] = yield* db
					.insert(dbSchema.organizationProvider)
					.values({
						...inputWithoutApiKey,
						organizationId: context.auth.session.activeOrganizationId,
						apiKeyEncrypted,
						createdAt: new Date(),
					})
					.returning({ ...getColumns(dbSchema.organizationProvider) });

				return { data: organizationProvider };
			}),
		),
	);

export const updateOrganizationProvider = authed.organizationProvider.update
	.use(requireActiveOrganizationMiddleware)
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "organization",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const { apiKey, ...inputWithoutApiKey } = input;
				const updateData =
					apiKey === undefined
						? inputWithoutApiKey
						: {
								...inputWithoutApiKey,
								apiKeyEncrypted: yield* Effect.promise(() =>
									encryptApiKey(apiKey),
								),
							};

				const [organizationProvider] = yield* db
					.update(dbSchema.organizationProvider)
					.set(updateData)
					.where(
						and(
							eq(
								dbSchema.organizationProvider.organizationId,
								context.auth.session.activeOrganizationId,
							),
							eq(
								dbSchema.organizationProvider.providerSlug,
								input.providerSlug,
							),
						),
					)
					.returning({ ...getColumns(dbSchema.organizationProvider) });

				return { data: organizationProvider };
			}),
		),
	);

export const deleteOrganizationProviders = authed.organizationProvider.delete
	.use(requireActiveOrganizationMiddleware)
	/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.providerSlug),
				action: "delete",
				entityType: "organization",
			}) satisfies CheckManyPermissionInput,
	) */
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db.delete(dbSchema.organizationProvider).where(
					and(
						eq(
							dbSchema.organizationProvider.organizationId,
							context.auth.session.activeOrganizationId,
						),
						inArray(
							dbSchema.organizationProvider.providerSlug,
							input.refs.map((ref) => ref.providerSlug),
						),
					),
				);

				return {
					success: true,
					message: "Organization providers deleted successfully",
				};
			}),
		),
	);
