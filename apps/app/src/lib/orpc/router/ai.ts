import { context as otelContext } from "@opentelemetry/api";
import { AiError } from "@orcai/ai";
import type {
	ChatId,
	ChatMessageId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import type {
	AiChatInput,
	ChatMessageMetadata,
	ClientToolOutput,
	DatabaseBlock,
	TemplateBlock,
	ToolApprovalDecision,
} from "@orcai/schema";
import { streamToEventIterator } from "@orpc/client";
import {
	createAgentUIStream,
	type FileUIPart,
	type InferAgentUIMessage,
	smoothStream,
	type TextStreamPart,
	type TextUIPart,
	type ToolSet,
	type UIMessage,
	type UIMessageStreamOutcome,
} from "ai";
import { asc, eq } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { forkChatTitleGenerationIfNeeded } from "@/lib/ai/effects/fork-chat-title-generation";
import { quotaDenialError } from "@/lib/ai/effects/generate-text-with-quota";
import { resolveFeatures } from "@/lib/ai/features/resolve-features";
import { loadedToolGroupsOf } from "@/lib/ai/tools/assistant/core/load-tools";
import { createAssistantTurn } from "@/lib/ai/tools/assistant/turn-state";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import {
	applyTurnDecisions,
	withoutContinuationClaim,
} from "@/lib/ai/utils/apply-turn-decisions";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { closePendingToolParts } from "@/lib/ai/utils/close-pending-tool-parts";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { loadAssistantUserContext } from "@/lib/ai/utils/load-assistant-user-context";
import { loadTurnChat } from "@/lib/ai/utils/load-turn-chat";
import { resolveTurnModel } from "@/lib/ai/utils/resolve-turn-model";
import { streamErrorText } from "@/lib/ai/utils/stream-error-text";
import { getZedToken } from "@/lib/authz/zed-token";
import { runPromise } from "@/lib/effect/runtime";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { chatBlockProcedures } from "./chat-block";
import {
	appendChatMessages,
	isEmptyReply,
	persistTurnDecisions,
	settleChatReply,
	storeClosedToolParts,
	turnNotAwaiting,
} from "./chat-message";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const getOptionalNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getTokenUsage = (totalUsage: unknown) => {
	if (!isRecord(totalUsage)) {
		return {
			inputTokens: undefined,
			outputTokens: undefined,
			totalTokens: undefined,
		};
	}

	return {
		inputTokens: getOptionalNumber(totalUsage.inputTokens),
		outputTokens: getOptionalNumber(totalUsage.outputTokens),
		totalTokens: getOptionalNumber(totalUsage.totalTokens),
	};
};

const messageIdTakenError = (cause?: unknown) =>
	new AppErrors.BadRequestError({
		reason: "CHAT_MESSAGE_ID_TAKEN",
		message: "Chat message id is already taken",
		cause,
	});

const mergeDatabaseBlocks = ({
	baseBlocks,
	attachedBlocks,
}: {
	baseBlocks: DatabaseBlock[];
	attachedBlocks: DatabaseBlock[];
}) => {
	if (attachedBlocks.length === 0) {
		return baseBlocks;
	}

	const merged = [
		...baseBlocks,
	];
	const existingIds = new Set(merged.map((block) => block.id));
	for (const block of attachedBlocks) {
		if (existingIds.has(block.id)) {
			continue;
		}
		merged.push(block);
		existingIds.add(block.id);
	}
	return merged;
};

/** Closes the pending tool calls of the last reply, which the model would reject. */
const closeLastReply = (history: ChatAgentUIMessage[], tools: ToolSet) => {
	const lastReply = history
		.filter((message) => message.role === "assistant")
		.at(-1);
	const closed = lastReply && closePendingToolParts(lastReply.parts, tools);

	if (!lastReply || !closed?.changed) {
		return {
			closedHistory: history,
			closedReply: undefined,
		};
	}

	const closedReply = {
		...lastReply,
		parts: closed.parts as ChatAgentUIMessage["parts"],
	};

	return {
		closedHistory: history.map((message) =>
			message === lastReply ? closedReply : message,
		),
		closedReply,
	};
};

const loadChatRows = (chatId: ChatId) =>
	Effect.gen(function* () {
		const db = yield* DB;

		return yield* db
			.select()
			.from(dbSchema.chatMessage)
			.where(eq(dbSchema.chatMessage.chatId, chatId))
			.orderBy(asc(dbSchema.chatMessage.position));
	});

const toAgentMessage = (row: typeof dbSchema.chatMessage.$inferSelect) =>
	({
		id: row.id,
		role: row.role,
		parts: row.parts,
		metadata: row.metadata,
		attachments: row.attachments,
	}) as ChatAgentUIMessage;

/** The assistant's fixed features. */
const ASSISTANT_FEATURES = {
	generativeUi: {},
};

type ChatTurn = {
	chat: typeof dbSchema.chat.$inferSelect;
	organizationId: OrganizationId;
	/** The signed-in user, who the assistant works for. */
	user: {
		id: UserId;
		name: string;
		email: string;
	};
	/** The request's context, reading at the request's zedToken. */
	context: ORPCContext;
	signal: AbortSignal | undefined;
	/** The chat's stored messages without empty replies. */
	history: ChatAgentUIMessage[];
	/** Where the assistant's procedure calls start reading. */
	turnZedToken: string | undefined;
} & (
	| {
			kind: "reply";
			userMessage: AiChatInput["message"];
	  }
	| {
			/** Resumes the last row of `history` once its last step is answered. */
			kind: "continuation";
			replyId: ChatMessageId;
			decisions: ToolApprovalDecision[];
			toolOutputs: ClientToolOutput[];
	  }
);

/**
 * One model turn: resolves model and settings, builds the agent, reserves
 * quota, persists the turn's rows, then streams onto the reply and settles it.
 */
const runChatTurn = (turn: ChatTurn) =>
	Effect.gen(function* () {
		const { chat, organizationId, user, context } = turn;
		const userId = user.id;
		const zedToken = context.meta?.zedToken;
		const isAssistant = chat.kind === "assistant";
		const chatConfig = isAssistant ? null : chat.config;

		const { providerId, modelId } = yield* resolveTurnModel({
			chat,
			organizationId,
		});

		const assistantUserContext = isAssistant
			? yield* loadAssistantUserContext({
					user,
					organizationId,
					context,
				})
			: undefined;

		const chatBlocks = isAssistant
			? []
			: (yield* chatBlockProcedures
					.list(
						{
							chatId: chat.id,
							zedToken,
						},
						{
							context,
						},
					)
					.pipe(
						Effect.mapError(
							(cause) =>
								new AppErrors.BadRequestError({
									reason: "CHAT_BLOCKS_UNAVAILABLE",
									message: "Failed to fetch chat blocks",
									cause,
								}),
						),
					)).data;

		const chatAiSettings = yield* getChatAiSettings({
			providerId,
			modelId,
			botId: chat.botId,
			chatConfig,
			userId,
			context,
		});

		const attachedDatabaseBlocks = chatBlocks.filter(
			(block): block is DatabaseBlock => block.type === "database",
		);
		const attachedTemplateBlock = chatBlocks.find(
			(block): block is TemplateBlock => block.type === "template",
		);

		const systemPrompt = !chat.botId
			? (attachedTemplateBlock?.config.systemPrompt ??
				chatAiSettings.systemPrompt)
			: chatAiSettings.systemPrompt;

		const allDatabaseBlocks = mergeDatabaseBlocks({
			baseBlocks: chatAiSettings.databaseBlocks,
			attachedBlocks: attachedDatabaseBlocks,
		});

		const telemetryIds = {
			organizationId,
			chatId: chat.id,
			providerId,
			modelId,
		};

		const { docs } = yield* AppConfigService;

		const assistantMessageId =
			turn.kind === "reply" ? (uuidv4() as ChatMessageId) : turn.replyId;

		const assistantTurn = assistantUserContext
			? createAssistantTurn({
					zedToken: turn.turnZedToken,
					chatId: chat.id,
					replyId: assistantMessageId,
				})
			: undefined;

		const turnAgent =
			assistantUserContext && assistantTurn
				? {
						kind: "assistant" as const,
						agent: createAssistantAgent({
							model: chatAiSettings.model,
							providerKind: chatAiSettings.provider.kind,
							generationParams: chatAiSettings.generationParams,
							docs,
							userContext: assistantUserContext,
							features: yield* resolveFeatures(ASSISTANT_FEATURES),
							loadedToolGroups: loadedToolGroupsOf(turn.history),
							history: turn.history,
							telemetryIds,
							context,
							turn: assistantTurn,
						}),
					}
				: {
						kind: "chat" as const,
						agent: createChatAgent({
							model: chatAiSettings.model,
							providerKind: chatAiSettings.provider.kind,
							systemPrompt,
							databaseBlocks: allDatabaseBlocks,
							features: chatAiSettings.features,
							generationParams: chatAiSettings.generationParams,
							telemetryIds,
							context,
						}),
					};

		const reply =
			turn.kind === "reply"
				? closeLastReply(turn.history, turnAgent.agent.tools)
				: undefined;
		const userMessageAttachments =
			turn.kind === "reply" ? getChatMessageAttachments(turn.userMessage) : [];

		const messages =
			turn.kind === "reply" && reply
				? [
						...reply.closedHistory,
						{
							id: turn.userMessage.id,
							role: "user",
							parts: turn.userMessage.parts,
							metadata: turn.userMessage.metadata,
							attachments: userMessageAttachments,
						} as ChatAgentUIMessage,
					]
				: turn.history;

		const quotaReservation = yield* reserveForAppRequest({
			organizationId,
			userId,
			providerId,
			providerModelId: modelId,
			appRequestId: assistantMessageId,
			messages,
			isFirstTurn: turn.kind === "reply" && turn.history.length === 0,
		});

		if (
			!quotaReservation.allowed ||
			quotaReservation.reservation === undefined
		) {
			return yield* Effect.fail(
				quotaDenialError(quotaReservation.denialReason),
			);
		}

		const reservation = quotaReservation.reservation;
		const releaseOnFailure = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			effect.pipe(
				Effect.catch((error) =>
					releaseAppRequestQuota({
						reservation,
						reason: "app_failure",
					}).pipe(
						Effect.catch(() => Effect.void),
						Effect.andThen(Effect.fail(error)),
					),
				),
			);

		const attachmentPartCache = new Map<string, FileUIPart | TextUIPart>();
		const messagesWithAttachmentParts = yield* Effect.forEach(
			messages,
			(message) =>
				Effect.gen(function* () {
					if (message.role !== "user") {
						return message;
					}

					const messageAttachments = getChatMessageAttachments(message);
					if (messageAttachments.length === 0) {
						return message;
					}

					const attachmentParts = yield* Effect.forEach(
						messageAttachments,
						(attachment) =>
							buildAttachmentPromptPartCached({
								attachment,
								cache: attachmentPartCache,
							}),
						{
							concurrency: 3,
						},
					);

					return {
						...message,
						parts: [
							...message.parts,
							...attachmentParts,
						],
					};
				}),
			{
				concurrency: "unbounded",
			},
		).pipe(releaseOnFailure);

		let claimedReply:
			| {
					parts: UIMessage["parts"];
					metadata: ChatMessageMetadata;
			  }
			| undefined;

		if (turn.kind === "reply") {
			const { userMessage } = turn;

			if (reply?.closedReply) {
				yield* storeClosedToolParts({
					id: reply.closedReply.id,
					chatId: chat.id,
					parts: reply.closedReply.parts,
				}).pipe(releaseOnFailure);
			}

			// The reply is reserved with the question, so a later turn always lands after it.
			const [persistedUserMessage] = yield* appendChatMessages(chat.id, [
				{
					id: userMessage.id,
					role: "user",
					parts: userMessage.parts,
					attachments: userMessageAttachments,
					metadata: (userMessage.metadata ?? {}) as Record<string, unknown>,
				},
				{
					id: assistantMessageId,
					role: "assistant",
					parts: [],
					attachments: [],
					metadata: {},
				},
			]).pipe(
				Effect.mapError((error) =>
					error instanceof AppErrors.BadRequestError &&
					error.reason === "CHAT_MESSAGE_ID_TAKEN"
						? error
						: new AppErrors.BadRequestError({
								reason: "CHAT_MESSAGE_CREATE_FAILED",
								message: "Failed to create user message",
								cause: error,
							}),
				),
				releaseOnFailure,
			);

			yield* forkChatTitleGenerationIfNeeded({
				chatId: chat.id,
				currentTitle: chat.title,
				model: chatAiSettings.model,
				organizationId,
				providerId,
				providerModelId: modelId,
				userId,
				userMessage: {
					id: persistedUserMessage.id,
					role: persistedUserMessage.role,
					parts: persistedUserMessage.parts,
				},
			});
		} else {
			claimedReply = yield* persistTurnDecisions({
				id: assistantMessageId,
				chatId: chat.id,
				decisions: turn.decisions,
				toolOutputs: turn.toolOutputs,
			}).pipe(releaseOnFailure);
		}

		let actualProviderRequestCount = 0;
		// A continuation's reply still carries the paused turn's usage until this one finishes.
		let finishedUsage: unknown;

		// The stream outlives the handler; its callbacks rejoin the request trace.
		const traceContext = otelContext.active();

		const logQuotaFailure = (message: string) => (error: unknown) =>
			runPromise(
				Effect.logError({
					appRequestId: reservation.appRequestId,
					error: error instanceof Error ? error.message : String(error),
					message,
					reservationKey: reservation.reservationKey,
				}),
			).catch(() => undefined);

		const turnStream = {
			uiMessages: messagesWithAttachmentParts,
			// Stop and disconnects abort the model call and running tools.
			abortSignal: turn.signal,
			generateMessageId: () => assistantMessageId,
			onStepEnd: () => {
				actualProviderRequestCount += 1;
			},
			onEnd: ({
				responseMessage,
				outcome,
			}: {
				responseMessage: Pick<ChatAgentUIMessage, "parts" | "metadata">;
				outcome: UIMessageStreamOutcome;
			}) =>
				otelContext.with(traceContext, async () => {
					const usage = getTokenUsage(finishedUsage);

					await runPromise(
						settleChatReply({
							id: assistantMessageId,
							chatId: chat.id,
							parts: responseMessage.parts,
							metadata: {
								...withoutContinuationClaim(responseMessage.metadata ?? {}),
								// A continuation reads on from what this turn wrote.
								...(assistantTurn?.zedToken === undefined
									? {}
									: {
											zedToken: assistantTurn.zedToken,
										}),
							},
						}),
					);

					if (outcome.status === "failed") {
						await runPromise(
							releaseAppRequestQuota({
								reservation,
								reason: "provider_failure",
							}),
						).catch(logQuotaFailure("quota.release.failed"));
						return;
					}

					await runPromise(
						finalizeAppRequestQuota({
							reservation,
							actualRequestCount: actualProviderRequestCount,
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
							totalTokens: usage.totalTokens,
						}),
					).catch(logQuotaFailure("quota.finalize.failed"));
				}),
			// Also called for every failed tool call, whose error text it returns.
			onError: (error: unknown) =>
				otelContext.with(traceContext, () => {
					runPromise(
						Effect.logError({
							error: error instanceof Error ? error.message : String(error),
							message: "AI stream error",
						}),
					).catch(() => undefined);
					return streamErrorText(error);
				}),
			messageMetadata: <Tools extends ToolSet>({
				part,
			}: {
				part: TextStreamPart<Tools>;
			}) => {
				if (part.type === "finish-step") {
					return {
						model: part.response.modelId,
						// Lets the client read what the turn wrote, such as the names on its cards.
						...(assistantTurn?.zedToken === undefined
							? {}
							: {
									zedToken: assistantTurn.zedToken,
								}),
					};
				}
				if (part.type === "finish") {
					finishedUsage = part.totalUsage;
					return {
						totalUsage: part.totalUsage,
					};
				}
			},
		};
		const wordStream = <Tools extends ToolSet>() =>
			smoothStream<Tools>({
				delayInMs: 20,
				chunking: "word",
			});

		return yield* Effect.tryPromise({
			try: async () =>
				turnAgent.kind === "assistant"
					? createAgentUIStream({
							...turnStream,
							agent: turnAgent.agent,
							// Each chat kind stores only its own agent's tool parts.
							originalMessages: messages as InferAgentUIMessage<
								ReturnType<typeof createAssistantAgent>,
								ChatMessageMetadata
							>[],
							experimental_transform: wordStream(),
						})
					: createAgentUIStream({
							...turnStream,
							agent: turnAgent.agent,
							originalMessages: messages as InferAgentUIMessage<
								ReturnType<typeof createChatAgent>,
								ChatMessageMetadata
							>[],
							experimental_transform: wordStream(),
						}),
			catch: (cause) =>
				new AiError({
					operation:
						turn.kind === "reply" ? "aiChat.handler" : "aiContinue.handler",
					cause,
				}),
		}).pipe(
			Effect.catch((error) =>
				Effect.all([
					releaseAppRequestQuota({
						reservation,
						reason: "app_failure",
					}).pipe(Effect.ignore),
					// A continuation keeps its decisions and drops its claim, so it can be retried.
					settleChatReply({
						id: assistantMessageId,
						chatId: chat.id,
						parts: claimedReply?.parts ?? [],
						metadata: claimedReply
							? withoutContinuationClaim(claimedReply.metadata)
							: {},
					}).pipe(Effect.ignore),
				]).pipe(Effect.andThen(Effect.fail(error))),
			),
		);
	});

const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context, signal }) {
		return yield* Effect.gen(function* () {
			const zedToken = getZedToken(context, input);
			const organizationId = context.auth.session.activeOrganizationId;
			const chat = yield* loadTurnChat({
				chatId: input.chatId,
				activeOrganizationId: organizationId,
			});

			const db = yield* DB;
			const [takenMessage] = yield* db
				.select({
					id: dbSchema.chatMessage.id,
				})
				.from(dbSchema.chatMessage)
				.where(eq(dbSchema.chatMessage.id, input.message.id))
				.limit(1);

			if (takenMessage) {
				return yield* Effect.fail(messageIdTakenError());
			}

			const rows = yield* loadChatRows(input.chatId);

			const stream = yield* runChatTurn({
				kind: "reply",
				chat,
				organizationId,
				user: {
					id: context.auth.user.id,
					name: context.auth.user.name,
					email: context.auth.user.email,
				},
				context: {
					...context,
					meta: {
						...context.meta,
						zedToken,
					},
				},
				signal,
				history: rows.filter((row) => !isEmptyReply(row)).map(toAgentMessage),
				turnZedToken: zedToken,
				userMessage: input.message,
			});

			return streamToEventIterator(stream);
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.logError(`[ai.chat] handler failed ${Cause.pretty(cause)}`),
			),
		);
	});

const aiContinue = authed.ai.continue
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context, signal }) {
		return yield* Effect.gen(function* () {
			const zedToken = getZedToken(context, input);
			const organizationId = context.auth.session.activeOrganizationId;
			const chat = yield* loadTurnChat({
				chatId: input.chatId,
				activeOrganizationId: organizationId,
			});

			if (chat.kind !== "assistant") {
				return yield* Effect.fail(
					turnNotAwaiting("Only assistant replies wait for answers."),
				);
			}

			const rows = yield* loadChatRows(input.chatId);
			const lastRow = rows.at(-1);
			const applied = applyTurnDecisions({
				messageId: input.messageId,
				lastMessage: lastRow && {
					id: lastRow.id,
					role: lastRow.role,
					parts: lastRow.parts as UIMessage["parts"],
					continuedAt: lastRow.metadata.continuedAt,
				},
				decisions: input.approvals,
				toolOutputs: input.toolOutputs,
				now: new Date(),
			});

			if (!applied.ok) {
				return yield* Effect.fail(
					applied.reason === "CHAT_TURN_NOT_AWAITING"
						? turnNotAwaiting(applied.message)
						: new AppErrors.BadRequestError({
								reason: applied.reason,
								message: applied.message,
							}),
				);
			}

			const history = rows
				.filter((row) => !isEmptyReply(row))
				.map((row) =>
					toAgentMessage(
						row.id === input.messageId
							? {
									...row,
									parts: applied.parts,
								}
							: row,
					),
				);

			const stream = yield* runChatTurn({
				kind: "continuation",
				chat,
				organizationId,
				user: {
					id: context.auth.user.id,
					name: context.auth.user.name,
					email: context.auth.user.email,
				},
				context: {
					...context,
					meta: {
						...context.meta,
						zedToken,
					},
				},
				signal,
				history,
				// A client call's write after the pause returns a token that also covers
				// the paused turn's writes; otherwise read on from the reply's own token.
				turnZedToken:
					input.toolOutputs.length > 0 && input.zedToken !== undefined
						? input.zedToken
						: (lastRow?.metadata.zedToken ?? zedToken),
				replyId: input.messageId,
				decisions: input.approvals,
				toolOutputs: input.toolOutputs,
			});

			return streamToEventIterator(stream);
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.logError(`[ai.continue] handler failed ${Cause.pretty(cause)}`),
			),
		);
	});

export const aiRouter = {
	chat: aiChat,
	continue: aiContinue,
};
