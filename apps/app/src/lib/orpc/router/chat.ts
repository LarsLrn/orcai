import {
	type ChatId,
	type ChatMessageId,
	isModelProviderKind,
	type ModelId,
	type OrganizationId,
	type ProviderId,
} from "@orcai/core";
import {
	chatMessageSearchText,
	chatMessageSearchVector,
	chatTitleSearchVector,
	DB,
	dbSchema,
} from "@orcai/db";
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
	exists,
	getColumns,
	inArray,
	lt,
	lte,
	notExists,
	or,
	sql,
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
import { lockExistingResource } from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	chatBotUsable,
	chatReadOnlyReason,
	requireWritableChat,
} from "@/lib/chats/read-only";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import { assistantConversationImmutable } from "./helpers/assistant-conversation";
import {
	HEADLINE_OPTIONS,
	prefixTsQuery,
	snippetOf,
} from "./helpers/chat-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const listChats = authed.chat.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const allowedIds = yield* lookupEntitiesByPermission({
			userId: context.auth.user.id,
			permission: "read",
			entityType: "chat",
			zedToken: getZedToken(context, input),
		});
		const search =
			input.filters?.search === undefined
				? undefined
				: prefixTsQuery(input.filters.search);
		const tsQuery = sql`to_tsquery('simple', ${search})`;
		const titleVector = chatTitleSearchVector(dbSchema.chat.title);
		const messageVector = chatMessageSearchVector(dbSchema.chatMessage.parts);
		const messageMatches = sql`${messageVector} @@ ${tsQuery}`;

		const conditions = [
			inArray(dbSchema.chat.id, allowedIds),
			eq(
				dbSchema.chat.organizationId,
				context.auth.session.activeOrganizationId,
			),
			// A search also finds the organisation's assistant conversations.
			search ? undefined : eq(dbSchema.chat.kind, "chat"),
			input.filters?.botId
				? eq(dbSchema.chat.botId, input.filters.botId)
				: undefined,
			search
				? or(
						sql`${titleVector} @@ ${tsQuery}`,
						exists(
							db
								.select({
									id: dbSchema.chatMessage.id,
								})
								.from(dbSchema.chatMessage)
								.where(
									and(
										eq(dbSchema.chatMessage.chatId, dbSchema.chat.id),
										messageMatches,
									),
								),
						),
					)
				: undefined,
		].filter((condition) => condition !== undefined);
		const whereClause = and(...conditions);

		const bestMessage = db
			.select({
				id: dbSchema.chatMessage.id,
				parts: dbSchema.chatMessage.parts,
				rank: sql<number>`ts_rank(${messageVector}, ${tsQuery})`.as("rank"),
			})
			.from(dbSchema.chatMessage)
			.where(
				and(eq(dbSchema.chatMessage.chatId, dbSchema.chat.id), messageMatches),
			)
			.orderBy(sql`rank desc`, desc(dbSchema.chatMessage.position))
			.limit(1)
			.as("best_message");
		// A title term weighs ten times one in a message.
		const rank = sql`greatest(ts_rank(setweight(${titleVector}, 'A'), ${tsQuery}), ${bestMessage.rank})`;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				title: dbSchema.chat.title,
				botName: dbSchema.bot.name,
				updatedAt: dbSchema.chat.updatedAt,
			} satisfies Record<ChatSortKey, SortExpression>,
			defaultOrder: [
				search ? desc(rank) : sql`${dbSchema.chat.pinnedAt} desc nulls last`,
				desc(dbSchema.chat.updatedAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.chat.id,
			},
		});

		const rows = db
			.select({
				...getColumns(dbSchema.chat),
				botName: dbSchema.bot.name,
				match: search
					? sql<{
							messageId: ChatMessageId;
							headline: string;
						} | null>`case when ${bestMessage.id} is null then null else json_build_object('messageId', ${bestMessage.id}, 'headline', ts_headline('simple', ${chatMessageSearchText(bestMessage.parts)}, ${tsQuery}, ${HEADLINE_OPTIONS})) end`
					: sql<null>`null`,
			})
			.from(dbSchema.chat)
			.leftJoin(dbSchema.bot, eq(dbSchema.chat.botId, dbSchema.bot.id))
			.$dynamic();

		return yield* Effect.all(
			[
				(search ? rows.leftJoinLateral(bestMessage, sql`true`) : rows)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.chat)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		).pipe(
			Effect.map(([rows, [countResult]]) => ({
				data: rows.map(({ match, ...chat }) => ({
					...chat,
					match: match && {
						messageId: match.messageId,
						snippet: snippetOf(match.headline),
					},
				})),
				rowCount: countResult.count,
			})),
		);
	});

/** Owner-only, so it needs no membership: the chats of organisations the user left. */
const listChatHistory = authed.chat.history.effect(function* ({
	input,
	context,
}) {
	const db = yield* DB;
	const whereClause = and(
		eq(dbSchema.chat.userId, context.auth.user.id),
		notExists(
			db
				.select({
					id: dbSchema.member.id,
				})
				.from(dbSchema.member)
				.where(
					and(
						eq(dbSchema.member.organizationId, dbSchema.chat.organizationId),
						eq(dbSchema.member.userId, context.auth.user.id),
					),
				),
		),
	);

	const [data, [rowCount]] = yield* Effect.all(
		[
			db
				.select({
					...getColumns(dbSchema.chat),
					organizationName: dbSchema.organization.name,
					botName: dbSchema.bot.name,
				})
				.from(dbSchema.chat)
				.innerJoin(
					dbSchema.organization,
					eq(dbSchema.organization.id, dbSchema.chat.organizationId),
				)
				.leftJoin(dbSchema.bot, eq(dbSchema.chat.botId, dbSchema.bot.id))
				.where(whereClause)
				.orderBy(desc(dbSchema.chat.updatedAt), desc(dbSchema.chat.id))
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({
					count: count(),
				})
				.from(dbSchema.chat)
				.where(whereClause),
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
		// Held until commit, so a bot deletion marks this chat or refuses it.
		if (
			values.botId &&
			!(yield* lockExistingResource({
				resourceType: "bot",
				resourceId: values.botId,
			}))
		) {
			return yield* new AppErrors.NotFoundError({
				reason: "BOT_NOT_FOUND",
				id: values.botId,
				message: "Bot not found",
			});
		}
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
					organization: {
						columns: {
							id: true,
							name: true,
						},
					},
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
		const activeOrganizationId = context.auth.session.activeOrganizationId;
		const [readableIds, membership, botUsable] = yield* Effect.all(
			[
				permittedEntityIds({
					entityIds: linkedIds,
					entityType: "chat",
					permission: "read",
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				}),
				chat.organizationId === activeOrganizationId
					? Effect.succeed(undefined)
					: db.query.member.findFirst({
							where: {
								organizationId: {
									eq: chat.organizationId,
								},
								userId: {
									eq: context.auth.user.id,
								},
							},
							columns: {
								id: true,
							},
						}),
				chatBotUsable(chat, {
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: {
				...chat,
				readOnly: chatReadOnlyReason(chat, {
					activeOrganizationId,
					isMember:
						chat.organizationId === activeOrganizationId ||
						membership !== undefined,
					botUsable,
				}),
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
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		if (modelId == null || maxTokens == null) {
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

/** A chat's provider is a model provider of the organisation, and its model belongs to it. */
const checkChatModel = ({
	providerId,
	modelId,
	organizationId,
}: {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		if (providerId == null && modelId == null) {
			return;
		}

		const db = yield* DB;

		if (providerId != null) {
			const [provider] = yield* db
				.select({
					kind: dbSchema.provider.kind,
				})
				.from(dbSchema.provider)
				.where(
					and(
						eq(dbSchema.provider.id, providerId),
						eq(dbSchema.provider.organizationId, organizationId),
					),
				)
				.limit(1);

			if (!provider) {
				return yield* new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					id: providerId,
					message: "Provider not found",
				});
			}

			if (!isModelProviderKind(provider.kind)) {
				return yield* new AppErrors.BadRequestError({
					reason: "PROVIDER_PURPOSE_MISMATCH",
					message:
						"Selected provider is a search provider. Please choose a chat model.",
				});
			}
		}

		if (modelId != null) {
			const [model] = yield* db
				.select({
					providerId: dbSchema.model.providerId,
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

			if (!model) {
				return yield* new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					id: modelId,
					message: "Model not found",
				});
			}

			if (providerId != null && model.providerId !== providerId) {
				return yield* new AppErrors.BadRequestError({
					reason: "MODEL_PROVIDER_MISMATCH",
					message:
						"Selected model does not belong to the selected provider. Please update chat settings.",
				});
			}
		}
	});

const createChat = authed.chat.create
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
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

		yield* checkChatModel({
			providerId: input.config?.providerId,
			modelId: input.config?.modelId,
			organizationId,
		});
		yield* checkMaxTokens({
			modelId: input.config?.modelId,
			maxTokens: input.config?.maxTokens,
			organizationId,
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
				organizationId,
			}),
		);

		return {
			data: chat,
		};
	});

const updateChat = authed.chat.update
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const existingChat = yield* db.query.chat
			.findFirst({
				where: {
					id: {
						eq: input.id,
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
		yield* requireWritableChat(existingChat, {
			activeOrganizationId: context.auth.session.activeOrganizationId,
			botUsable: chatBotUsable(existingChat, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			}),
		});
		const features = input.config?.features;

		if (features !== undefined) {
			if (existingChat.botId) {
				return yield* botFeaturesImmutable();
			}

			if (features) {
				yield* checkFeatureRequirements(features);
			}
		}

		if (existingChat.kind === "assistant" && input.config !== undefined) {
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
								...(existingChat.config ?? {}),
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

		if (
			input.config != null &&
			(input.config.providerId !== undefined ||
				input.config.modelId !== undefined)
		) {
			yield* checkChatModel({
				providerId:
					input.config.providerId === undefined
						? existingChat.config?.providerId
						: input.config.providerId,
				modelId:
					input.config.modelId === undefined
						? existingChat.config?.modelId
						: input.config.modelId,
				organizationId: existingChat.organizationId,
			});
		}

		// Only a new max tokens is checked; a model switch keeps it and the turn caps it.
		if (input.config?.maxTokens != null) {
			yield* checkMaxTokens({
				modelId:
					input.config.modelId === undefined
						? existingChat.config?.modelId
						: input.config.modelId,
				maxTokens: input.config.maxTokens,
				organizationId: existingChat.organizationId,
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

const pinChat = authed.chat.pin
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const [existing] = yield* db
			.select({
				kind: dbSchema.chat.kind,
			})
			.from(dbSchema.chat)
			.where(eq(dbSchema.chat.id, input.id));

		if (existing?.kind === "assistant") {
			return yield* Effect.fail(assistantConversationImmutable());
		}

		const [chat] = yield* db
			.update(dbSchema.chat)
			.set({
				pinnedAt: input.pinned ? new Date() : null,
			})
			.where(eq(dbSchema.chat.id, input.id))
			.returning();

		return {
			data: yield* Effect.fromNullishOr(chat).pipe(
				Effect.mapError(() => chatNotFound(input.id)),
			),
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
	.use(requireActiveOrganizationMiddleware)
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
		yield* requireWritableChat(source, {
			activeOrganizationId: context.auth.session.activeOrganizationId,
			botUsable: chatBotUsable(source, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context, input),
			}),
		});

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
					organizationId: source.organizationId,
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
	history: listChatHistory,
	create: createChat,
	find: findChat,
	update: updateChat,
	pin: pinChat,
	delete: deleteChats,
	branch: branchChat,
};
