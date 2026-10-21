import type {
	ChatId,
	ChatMessageId,
	ModelId,
	OrganizationId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ChatSortKey } from "@orcai/schema";
import {
	lookupEntitiesByPermission,
	permittedEntityIds,
} from "@orcai/spice-db";
import { isTextUIPart, type UIMessage } from "ai";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	lt,
	lte,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { checkFeatureRequirements } from "@/lib/ai/features/requirements";
import { isEmptyReply } from "@/lib/ai/turn/reply-store";
import { closeCopiedToolParts } from "@/lib/ai/utils/close-pending-tool-parts";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import { assistantConversationImmutable } from "./helpers/assistant-conversation";
import { literalSearch } from "./helpers/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const listChats = authed.chat.list.effect(function* ({ input, context }) {
	const db = yield* DB;

	const allowedIds = yield* lookupEntitiesByPermission({
		userId: context.auth.user.id,
		permission: "read",
		entityType: "chat",
		zedToken: getZedToken(context, input),
	});
	const conditions = [
		inArray(dbSchema.chat.id, allowedIds),
		eq(dbSchema.chat.kind, "chat"),
		input.filters?.botId
			? eq(dbSchema.chat.botId, input.filters.botId)
			: undefined,
		input.filters?.search
			? ilike(dbSchema.chat.title, literalSearch(input.filters.search))
			: undefined,
	].filter((condition) => condition !== undefined);
	const whereClause = and(...conditions);
	const orderBy = yield* buildOrderBy({
		sort: input.sort,
		allowlist: {
			title: dbSchema.chat.title,
			botName: dbSchema.bot.name,
			updatedAt: dbSchema.chat.updatedAt,
		} satisfies Record<ChatSortKey, SortExpression>,
		defaultOrder: [
			desc(dbSchema.chat.updatedAt),
		],
		tieBreaker: {
			id: "id",
			expression: dbSchema.chat.id,
		},
	});

	return yield* Effect.all(
		[
			db
				.select({
					...getColumns(dbSchema.chat),
					botName: dbSchema.bot.name,
				})
				.from(dbSchema.chat)
				.leftJoin(dbSchema.bot, eq(dbSchema.chat.botId, dbSchema.bot.id))
				.where(whereClause)
				.orderBy(...orderBy)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({
					count: count(),
				})
				.from(dbSchema.chat)
				.leftJoin(dbSchema.bot, eq(dbSchema.chat.botId, dbSchema.bot.id))
				.where(whereClause),
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

const chatNotFound = (id: ChatId) =>
	new AppErrors.NotFoundError({
		reason: "CHAT_NOT_FOUND",
		id,
		message: "Chat not found",
	});

/** Inserts a chat and records its owner and bot; call it in a {@link writeRelationships}. */
export const insertChat = (values: typeof dbSchema.chat.$inferInsert) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [chat] = yield* db.insert(dbSchema.chat).values(values).returning();
		yield* recordRelationshipFacts(
			RelationshipFact.ChatCreated({
				chatId: chat.id,
				ownerId: chat.userId,
				botId: chat.botId,
			}),
		);
		return chat;
	});

const findChat = authed.chat.find
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const chat = yield* db.query.chat
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
				with: {
					parentChat: {
						columns: {
							id: true,
							title: true,
						},
					},
					branches: {
						columns: {
							id: true,
							title: true,
							branchedFromMessageId: true,
							createdAt: true,
						},
						where: {
							branchedFromMessageId: {
								isNotNull: true,
							},
						},
						orderBy: {
							createdAt: "asc",
						},
					},
				},
			})
			.pipe(
				Effect.flatMap((chat) =>
					Effect.fromNullishOr(chat).pipe(
						Effect.mapError(() => chatNotFound(input.id)),
					),
				),
			);

		const linkedIds = [
			...(chat.parentChat
				? [
						chat.parentChat.id,
					]
				: []),
			...chat.branches.map((branch) => branch.id),
		];
		const readableIds = yield* permittedEntityIds({
			entityIds: linkedIds,
			entityType: "chat",
			permission: "read",
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		return {
			data: {
				...chat,
				parentChat:
					chat.parentChat && readableIds.has(chat.parentChat.id)
						? chat.parentChat
						: null,
				branches: chat.branches.flatMap(
					({ branchedFromMessageId, ...branch }) =>
						branchedFromMessageId && readableIds.has(branch.id)
							? [
									{
										...branch,
										branchedFromMessageId,
									},
								]
							: [],
				),
			},
		};
	});

const botFeaturesImmutable = () =>
	new AppErrors.BadRequestError({
		reason: "CHAT_BOT_FEATURES_IMMUTABLE",
		message: "Cannot set features on chats linked to a bot.",
	});

/** A chat's max tokens stay within its model's max output, where that is known. */
const checkMaxTokens = ({
	modelId,
	maxTokens,
	organizationId,
}: {
	modelId: ModelId | null | undefined;
	maxTokens: number | null | undefined;
	organizationId: OrganizationId | undefined;
}) =>
	Effect.gen(function* () {
		if (modelId == null || maxTokens == null || organizationId === undefined) {
			return;
		}

		const db = yield* DB;
		const [model] = yield* db
			.select({
				maxOutputTokens: dbSchema.model.maxOutputTokens,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, modelId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (model?.maxOutputTokens != null && maxTokens > model.maxOutputTokens) {
			return yield* new AppErrors.BadRequestError({
				reason: "CHAT_MAX_TOKENS_EXCEEDS_MODEL",
				params: {
					maxOutputTokens: model.maxOutputTokens,
				},
				message: "Max tokens exceed the model's max output tokens.",
			});
		}
	});

const createChat = authed.chat.create.effect(function* ({ input, context }) {
	const features = input.config?.features;

	if (input.botId) {
		if (features !== undefined) {
			return yield* botFeaturesImmutable();
		}

		yield* requirePermission({
			entityType: "bot",
			entityId: input.botId,
			permission: "use",
			userId: context.auth.user.id,
			zedToken: getZedToken(context),
		});
	} else if (features) {
		yield* checkFeatureRequirements(features);
	}

	yield* checkMaxTokens({
		modelId: input.config?.modelId,
		maxTokens: input.config?.maxTokens,
		organizationId: context.auth.session.activeOrganizationId,
	});

	const { result: chat } = yield* writeRelationships(
		{
			organizationIds: [],
		},
		insertChat({
			title: input.title,
			userId: context.auth.user.id,
			botId: input.botId,
			config: input.config ?? {},
		}),
	);

	return {
		data: chat,
	};
});

const updateChat = authed.chat.update
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const existingChat = yield* db.query.chat.findFirst({
			where: {
				id: {
					eq: input.id,
				},
			},
		});
		const features = input.config?.features;

		if (features !== undefined) {
			if (existingChat?.botId) {
				return yield* botFeaturesImmutable();
			}

			if (features) {
				yield* checkFeatureRequirements(features);
			}
		}

		if (existingChat?.kind === "assistant" && input.config !== undefined) {
			return yield* Effect.fail(assistantConversationImmutable());
		}

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

		// Only a new max tokens is checked; a model switch keeps it and the turn caps it.
		if (input.config?.maxTokens != null) {
			yield* checkMaxTokens({
				modelId:
					input.config.modelId === undefined
						? existingChat?.config?.modelId
						: input.config.modelId,
				maxTokens: input.config.maxTokens,
				organizationId: context.auth.session.activeOrganizationId,
			});
		}

		const [updatedChat] = yield* db
			.update(dbSchema.chat)
			.set({
				updatedAt: new Date(),
				title: input.title,
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
						reason: "CHAT_NOT_FOUND",
						id: input.id,
						message: "Chat not found",
					}),
			),
		);

		return {
			data: chat,
		};
	});

const deleteChats = authed.chat.delete
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

const branchChat = authed.chat.branch
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const source = yield* db.query.chat
			.findFirst({
				where: {
					id: {
						eq: input.chatId,
					},
				},
			})
			.pipe(
				Effect.flatMap((chat) =>
					Effect.fromNullishOr(chat).pipe(
						Effect.mapError(() => chatNotFound(input.chatId)),
					),
				),
			);

		if (source.kind === "assistant") {
			return yield* Effect.fail(assistantConversationImmutable());
		}

		const message = yield* db.query.chatMessage
			.findFirst({
				where: {
					id: {
						eq: input.messageId,
					},
					chatId: {
						eq: input.chatId,
					},
				},
			})
			.pipe(
				Effect.flatMap((message) =>
					Effect.fromNullishOr(message).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "CHAT_MESSAGE_NOT_FOUND",
									id: input.messageId,
									message: "Chat message not found",
								}),
						),
					),
				),
			);

		if (source.botId) {
			yield* requirePermission({
				entityType: "bot",
				entityId: source.botId,
				permission: "use",
				userId: context.auth.user.id,
				zedToken: getZedToken(context, input),
			});
		}

		// A user message becomes the draft, so the branch ends before it.
		const isUserMessage = message.role === "user";
		const copiedPositions = isUserMessage
			? lt(dbSchema.chatMessage.position, message.position)
			: lte(dbSchema.chatMessage.position, message.position);

		const { result: chat } = yield* writeRelationships(
			{
				organizationIds: [],
			},
			Effect.gen(function* () {
				const chat = yield* insertChat({
					title: source.title,
					userId: context.auth.user.id,
					botId: source.botId,
					config: source.config,
					parentChatId: source.id,
					branchedFromMessageId: message.id,
				});

				const messages = closeCopiedToolParts(
					(yield* db
						.select()
						.from(dbSchema.chatMessage)
						.where(
							and(eq(dbSchema.chatMessage.chatId, source.id), copiedPositions),
						)
						.orderBy(asc(dbSchema.chatMessage.position))).filter(
						(message) => !isEmptyReply(message),
					),
				);

				if (messages.length > 0) {
					yield* db.insert(dbSchema.chatMessage).values(
						messages.map((copied, position) => ({
							...copied,
							id: uuidv4() as ChatMessageId,
							chatId: chat.id,
							position,
						})),
					);
				}

				const blocks = yield* db
					.select()
					.from(dbSchema.chatBlock)
					.where(eq(dbSchema.chatBlock.chatId, source.id));

				if (blocks.length > 0) {
					yield* db.insert(dbSchema.chatBlock).values(
						blocks.map((block) => ({
							...block,
							chatId: chat.id,
						})),
					);
				}

				return chat;
			}),
		);

		return {
			data: chat,
			draft: isUserMessage
				? {
						text: (message.parts as UIMessage["parts"])
							.filter(isTextUIPart)
							.map((part) => part.text)
							.join("\n\n"),
						attachments: message.attachments,
					}
				: null,
		};
	});

export const chatRouter = {
	list: listChats,
	create: createChat,
	find: findChat,
	update: updateChat,
	delete: deleteChats,
	branch: branchChat,
};
