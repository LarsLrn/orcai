import { count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	checkEntityPermission,
	hasPermission,
	lookupEntitiesByPermission,
} from "@/lib/spice-db/client";
import { DEFAULT_CHAT_TITLE } from "@/lib/ai/generate-chat-title";

export const listChats = authed.chat.list.handler(async ({ input, context }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const allowedIds = yield* lookupEntitiesByPermission({
				userId: context.auth.user.id,
				permission: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}).pipe(
				Effect.map((response) => response.map((item) => item.resourceObjectId)),
			);

			return yield* Effect.all(
				[
					db.query.chat.findMany({
						where: {
							id: {
								in: allowedIds,
							},
						},
						orderBy: {
							createdAt: "desc",
						},
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					}),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.chat)
						.where(inArray(dbSchema.chat.id, allowedIds)),
				],
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.map(([data, [countResult]]) => ({
					data,
					rowCount: countResult.count,
				})),
			);
		}),
	),
);

export const findChat = authed.chat.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "chat",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.chat
					.findFirst({
						where: {
							id: input.id,
						},
						with: {
							branches: {
								orderBy: {
									updatedAt: "desc",
								},
							},
						},
					})
					.pipe(
						Effect.flatMap((chat) =>
							Effect.fromNullable(chat).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Chat not found",
										}),
									),
								),
							),
						),
						Effect.map((chat) => ({
							data: chat,
						})),
					);
			}),
		),
	);

export const createChat = authed.chat.create.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				if (input.botId) {
					const canUseBot = yield* checkEntityPermission({
						entityId: input.botId,
						entityType: "bot",
						permission: "use",
						userId: context.auth.user.id,
						zedToken: context.meta?.zedToken,
					});

					if (hasPermission(canUseBot) === false) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								data: {
									allowed: false,
									permission: "use",
									entityType: "bot",
									zedToken: context.meta?.zedToken,
								},
							}),
						);
					}
				}

				const { chat, mainBranch } = yield* db.transaction((tx) =>
					Effect.gen(function* () {
						const [chat] = yield* tx
							.insert(dbSchema.chat)
							.values({
								title: input.title ?? DEFAULT_CHAT_TITLE,
								userId: context.auth.user.id,
								botId: input.botId,
								config: input.config ?? {},
							})
							.returning();

						const [mainBranch] = yield* tx
							.insert(dbSchema.chatBranch)
							.values({
								chatId: chat.id,
								name: "Main",
								leafMessageId: null,
							})
							.returning();

						yield* tx
							.update(dbSchema.chat)
							.set({
								activeBranchId: mainBranch.id,
							})
							.where(eq(dbSchema.chat.id, chat.id));

						return {
							chat,
							mainBranch,
						};
					}),
				);

				const relationResult = yield* authz.applyRelationshipMutations({
					mutations: [
						{
							resourceType: "chat",
							resourceId: chat.id,
							relation: "owner",
							subjectType: "user",
							subjectId: context.auth.user.id,
							operation: "touch",
						},
						...(chat.botId
							? [
									{
										resourceType: "chat" as const,
										resourceId: chat.id,
										relation: "bot" as const,
										subjectType: "bot" as const,
										subjectId: chat.botId,
										operation: "touch" as const,
									},
								]
							: []),
					],
				});

				return {
					data: {
						...chat,
						activeBranchId: mainBranch.id,
					},
					meta: {
						zedToken: relationResult.zedToken,
					},
				};
			}),
		),
);

export const updateChat = authed.chat.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const existingChat = yield* db.query.chat.findFirst({
					where: {
						id: input.id,
					},
				});

				const configPatch =
					input.config === undefined
						? undefined
						: Object.fromEntries(
								Object.entries(input.config).filter(
									([, value]) => value !== undefined,
								),
							);

				const mergedConfig =
					configPatch === undefined
						? undefined
						: (() => {
								const nextConfig = {
									...(existingChat?.config ?? {}),
								} as Record<string, unknown>;

								for (const [key, value] of Object.entries(configPatch)) {
									if (value === null) {
										delete nextConfig[key];
										continue;
									}
									nextConfig[key] = value;
								}

								return nextConfig;
							})();

				return yield* db
					.update(dbSchema.chat)
					.set({
						updatedAt: new Date(),
						title: input.title,
						activeBranchId: input.activeBranchId,
						...(mergedConfig !== undefined && {
							config: mergedConfig,
						}),
					})
					.where(eq(dbSchema.chat.id, input.id))
					.returning();
			}).pipe(
				Effect.flatMap(([updatedChat]) =>
					Effect.fromNullable(updatedChat).pipe(
						Effect.orElse(() =>
							Effect.fail(
								errors.NOT_FOUND({
									message: "Chat not found",
									data: {
										id: input.id,
									},
								}),
							),
						),
						Effect.map((chat) => ({
							data: chat,
						})),
					),
				),
			),
		),
	);

export const deleteChats = authed.chat.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "chat",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db
					.delete(dbSchema.chat)
					.where(inArray(dbSchema.chat.id, context.allowedIds));

				return {
					success: true,
					message: "Chats deleted successfully",
				};
			}),
		),
	);
