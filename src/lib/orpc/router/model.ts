import { call } from "@orpc/server";
import { count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import OpenAI from "openai";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { decryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import type { ModelCapability } from "@/lib/orpc/schemas/fragments/model-capabilities";
import { findProvider } from "./provider";

export const listModels = authed.model.list
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [data, [rowCount]] = yield* Effect.all(
					[
						db.query.model.findMany({
							limit: input.pageSize,
							offset: input.pageIndex * input.pageSize,
						}),
						db.select({ count: count() }).from(dbSchema.model),
					],
					{ concurrency: "unbounded" },
				);

				return { data, rowCount: rowCount.count };
			}),
		),
	);

export const findModel = authed.model.find
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const model = yield* db.query.model
					.findFirst({
						where: {
							id: input.id,
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

				return { data: model };
			}),
		),
	);

export const createModel = authed.model.create
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [model] = yield* db
					.insert(dbSchema.model)
					.values(input)
					.returning();

				return { data: model };
			}),
		),
	);

export const updateModel = authed.model.update
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [model] = yield* db
					.update(dbSchema.model)
					.set(input)
					.where(eq(dbSchema.model.id, input.id))
					.returning();

				if (!model) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Model not found" }),
					);
				}

				return { data: model };
			}),
		),
	);

export const deleteModel = authed.model.delete
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db.delete(dbSchema.model).where(
					inArray(
						dbSchema.model.id,
						input.refs.map((ref) => ref.id),
					),
				);

				return { success: true, message: "Models deleted successfully" };
			}),
		),
	);

export const discoverModels = authed.model.discover.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const { data: provider } = yield* Effect.tryPromise({
					try: () => call(findProvider, { id: input.providerId }, { context }),
					catch: (cause) =>
						errors.BAD_REQUEST({
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
						errors.BAD_REQUEST({
							message: "Failed to fetch models from provider",
							cause,
						}),
				});

				const modelsToInsert = res.data.map((model) => ({
					providerId: input.providerId,
					providerModelId: model.id,
					name: model.id,
					description: `Model ID: ${model.id} | Owned by ${model.owned_by}`,
					capabilities: ["text"] satisfies ModelCapability[],
				}));

				const insertedModels =
					modelsToInsert.length === 0
						? []
						: yield* db
								.insert(dbSchema.model)
								.values(modelsToInsert)
								.onConflictDoNothing()
								.returning({ id: dbSchema.model.id });

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
			}),
		),
);
