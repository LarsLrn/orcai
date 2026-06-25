import { DEFAULT_CHAT_TITLE } from "@orcai/ai";
import { DB, dbSchema } from "@orcai/db";
import {
	checkEntityPermission,
	hasPermission,
	lookupEntitiesByPermission,
} from "@orcai/spice-db";
import { count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";

export const listChats = authed.chat.list.effect(function* ({
	input,
	context,
}) {
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
});

export const findChat = authed.chat.find
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db.query.chat
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
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
					Effect.fromNullishOr(chat).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									message: "Chat not found",
								}),
						),
					),
				),
				Effect.map((chat) => ({
					data: chat,
				})),
			);
	});

export const createChat = authed.chat.create.effect(function* ({
	input,
	context,
}) {
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
				new AppErrors.ForbiddenError({
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
});

export const updateChat = authed.chat.update
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const existingChat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.id,
				},
			},
		});

		const configPatch =
			input.config == null
				? input.config
				: Object.fromEntries(
						Object.entries(input.config).filter(
							([, value]) => value !== undefined,
						),
					);

		const mergedConfig =
			configPatch === undefined
				? undefined
				: configPatch === null
					? null
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

		const [updatedChat] = yield* db
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

		const chat = yield* Effect.fromNullishOr(updatedChat).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						message: "Chat not found",
						data: {
							id: input.id,
						},
					}),
			),
		);

		return {
			data: chat,
		};
	});

export const deleteChats = authed.chat.delete
	.use(
		checkManyPermissionMiddleware("chat").adaptInput(
			(input): CheckManyPermissionInputFor<"chat"> => ({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
			}),
		),
	)
	.effect(function* ({ context }) {
		const db = yield* DB;

		yield* db
			.delete(dbSchema.chat)
			.where(inArray(dbSchema.chat.id, context.allowedIds));

		return {
			success: true,
			message: "Chats deleted successfully",
		};
	});
