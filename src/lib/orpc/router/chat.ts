import { count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listChats = authed.chat.list.handler(async ({ input, context }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const allowedIds = yield* listAllowedEntities({
				userId: context.auth.user.id,
				action: "read",
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
						orderBy: { createdAt: "desc" },
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					}),
					db
						.select({ count: count() })
						.from(dbSchema.chat)
						.where(inArray(dbSchema.chat.id, allowedIds)),
				],
				{ concurrency: "unbounded" },
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
				action: "read",
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
								orderBy: { updatedAt: "desc" },
							},
						},
					})
					.pipe(
						Effect.flatMap((chat) =>
							Effect.fromNullable(chat).pipe(
								Effect.orElse(() =>
									Effect.fail(errors.NOT_FOUND({ message: "Chat not found" })),
								),
							),
						),
						Effect.map((chat) => ({ data: chat })),
					);
			}),
		),
	);

// TODO: Add permission check for botId
export const createChat = authed.chat.create.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const { chat, mainBranch } = yield* db.transaction((tx) =>
					Effect.gen(function* () {
						const [chat] = yield* tx
							.insert(dbSchema.chat)
							.values({
								title: input.title ?? "New Chat",
								userId: context.auth.user.id,
								botId: input.botId,
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
							.set({ activeBranchId: mainBranch.id })
							.where(eq(dbSchema.chat.id, chat.id));

						return { chat, mainBranch };
					}),
				);

				const relationResult = yield* createRelation({
					entityId: chat.id,
					entityType: "chat",
					userId: context.auth.user.id,
					relation: "owner",
				});

				return {
					data: { ...chat, activeBranchId: mainBranch.id },
					meta: { zedToken: relationResult.zedToken },
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
				action: "update",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db
					.update(dbSchema.chat)
					.set({
						updatedAt: new Date(),
						title: input.title,
						activeBranchId: input.activeBranchId,
					})
					.where(eq(dbSchema.chat.id, input.id))
					.returning();
			}).pipe(
				Effect.map(([updatedChat]) => ({
					data: updatedChat,
				})),
			),
		),
	);

export const deleteChats = authed.chat.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
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

				return { success: true, message: "Chats deleted successfully" };
			}),
		),
	);
