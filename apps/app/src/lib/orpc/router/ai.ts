import { context as otelContext } from "@opentelemetry/api";
import { AiError } from "@orcai/ai";
import type { ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import type { DatabaseBlock, TemplateBlock } from "@orcai/schema";
import { streamToEventIterator } from "@orpc/client";
import {
	createAgentUIStream,
	type FileUIPart,
	smoothStream,
	type TextStreamPart,
	type TextUIPart,
	type ToolSet,
} from "ai";
import { asc, eq } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { forkChatTitleGenerationIfNeeded } from "@/lib/ai/effects/fork-chat-title-generation";
import { quotaDenialError } from "@/lib/ai/effects/generate-text-with-quota";
import type { AssistantAgentUIMessage } from "@/lib/ai/types/assistant-agent-message";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { closePendingToolParts } from "@/lib/ai/utils/close-pending-tool-parts";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { loadTurnChat } from "@/lib/ai/utils/load-turn-chat";
import { resolveTurnModel } from "@/lib/ai/utils/resolve-turn-model";
import { streamErrorReason } from "@/lib/ai/utils/stream-error-reason";
import { getZedToken } from "@/lib/authz/zed-token";
import { runPromise } from "@/lib/effect/runtime";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { chatBlockProcedures } from "./chat-block";
import {
	appendChatMessages,
	isEmptyReply,
	settleChatReply,
	storeClosedToolParts,
} from "./chat-message";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const getOptionalNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getTokenUsageFromMetadata = (metadata: unknown) => {
	if (!isRecord(metadata) || !isRecord(metadata.totalUsage)) {
		return {
			inputTokens: undefined,
			outputTokens: undefined,
			totalTokens: undefined,
		};
	}

	return {
		inputTokens: getOptionalNumber(metadata.totalUsage.inputTokens),
		outputTokens: getOptionalNumber(metadata.totalUsage.outputTokens),
		totalTokens: getOptionalNumber(metadata.totalUsage.totalTokens),
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
			const requestContext = {
				...context,
				meta: {
					...context.meta,
					zedToken,
				},
			};
			const userMessage = input.message;
			const userMessageAttachments = getChatMessageAttachments(userMessage);

			const db = yield* DB;
			const organizationId = context.auth.session.activeOrganizationId;
			const chatRecord = yield* loadTurnChat({
				chatId: input.chatId,
				activeOrganizationId: organizationId,
			});
			const isAssistant = chatRecord.kind === "assistant";
			const chatConfig = isAssistant ? null : chatRecord.config;

			const { providerId, modelId } = yield* resolveTurnModel({
				chat: chatRecord,
				organizationId,
			});

			const chatBlocks = isAssistant
				? []
				: (yield* chatBlockProcedures
						.list(
							{
								chatId: input.chatId,
								zedToken,
							},
							{
								context: requestContext,
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
				botId: chatRecord.botId,
				chatConfig,
				userId: context.auth.user.id,
				context: requestContext,
			});

			const attachedDatabaseBlocks = chatBlocks.filter(
				(block): block is DatabaseBlock => block.type === "database",
			);
			const attachedTemplateBlock = chatBlocks.find(
				(block): block is TemplateBlock => block.type === "template",
			);

			const systemPrompt = !chatRecord.botId
				? (attachedTemplateBlock?.config.systemPrompt ??
					chatAiSettings.systemPrompt)
				: chatAiSettings.systemPrompt;

			const allDatabaseBlocks = mergeDatabaseBlocks({
				baseBlocks: chatAiSettings.databaseBlocks,
				attachedBlocks: attachedDatabaseBlocks,
			});

			const telemetryIds = {
				organizationId,
				chatId: input.chatId,
				providerId,
				modelId,
			};
			const turnAgent = isAssistant
				? {
						kind: "assistant" as const,
						agent: createAssistantAgent({
							model: chatAiSettings.model,
							generationParams: chatAiSettings.generationParams,
							telemetryIds,
						}),
					}
				: {
						kind: "chat" as const,
						agent: createChatAgent({
							model: chatAiSettings.model,
							systemPrompt,
							databaseBlocks: allDatabaseBlocks,
							features: chatAiSettings.features,
							generationParams: chatAiSettings.generationParams,
							telemetryIds,
							context: requestContext,
						}),
					};

			const [takenMessage] = yield* db
				.select({
					id: dbSchema.chatMessage.id,
				})
				.from(dbSchema.chatMessage)
				.where(eq(dbSchema.chatMessage.id, userMessage.id))
				.limit(1);

			if (takenMessage) {
				return yield* Effect.fail(messageIdTakenError());
			}

			const history = (yield* db
				.select()
				.from(dbSchema.chatMessage)
				.where(eq(dbSchema.chatMessage.chatId, input.chatId))
				.orderBy(asc(dbSchema.chatMessage.position))).filter(
				(row) => !isEmptyReply(row),
			);

			const storedMessages = history.map(
				(row) =>
					({
						id: row.id,
						role: row.role,
						parts: row.parts,
						metadata: row.metadata,
						attachments: row.attachments,
					}) as ChatAgentUIMessage,
			);

			const { closedHistory, closedReply } = closeLastReply(
				storedMessages,
				turnAgent.agent.tools,
			);

			const messages = [
				...closedHistory,
				{
					id: userMessage.id,
					role: "user",
					parts: userMessage.parts,
					metadata: userMessage.metadata,
					attachments: userMessageAttachments,
				} as ChatAgentUIMessage,
			];

			const assistantMessageId = uuidv4() as ChatMessageId;

			const quotaReservation = yield* reserveForAppRequest({
				organizationId,
				userId: context.auth.user.id,
				providerId,
				providerModelId: modelId,
				appRequestId: assistantMessageId,
				messages,
				isFirstTurn: history.length === 0,
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
			);

			if (closedReply) {
				yield* storeClosedToolParts({
					id: closedReply.id,
					chatId: input.chatId,
					parts: closedReply.parts,
				}).pipe(releaseOnFailure);
			}

			// The reply is reserved with the question, so a later turn always lands after it.
			const [persistedUserMessage] = yield* appendChatMessages(input.chatId, [
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
				chatId: input.chatId,
				currentTitle: chatRecord.title,
				model: chatAiSettings.model,
				organizationId,
				providerId,
				providerModelId: modelId,
				userId: context.auth.user.id,
				userMessage: {
					id: persistedUserMessage.id,
					role: persistedUserMessage.role,
					parts: persistedUserMessage.parts,
				},
			});

			let actualProviderRequestCount = 0;

			// The stream outlives the handler; its callbacks rejoin the request trace.
			const traceContext = otelContext.active();

			const turnStream = {
				uiMessages: messagesWithAttachmentParts,
				// Stop and disconnects abort the model call and running tools.
				abortSignal: signal,
				generateMessageId: () => assistantMessageId,
				onStepEnd: () => {
					actualProviderRequestCount += 1;
				},
				onEnd: ({
					responseMessage,
				}: {
					responseMessage: Pick<ChatAgentUIMessage, "parts" | "metadata">;
				}) =>
					otelContext.with(traceContext, async () => {
						const usage = getTokenUsageFromMetadata(responseMessage.metadata);

						await runPromise(
							settleChatReply({
								id: assistantMessageId,
								chatId: input.chatId,
								parts: responseMessage.parts,
								metadata: responseMessage.metadata ?? {},
							}),
						);

						await runPromise(
							finalizeAppRequestQuota({
								reservation,
								actualRequestCount: actualProviderRequestCount,
								inputTokens: usage.inputTokens,
								outputTokens: usage.outputTokens,
								totalTokens: usage.totalTokens,
							}),
						).catch((error) =>
							runPromise(
								Effect.logError({
									appRequestId: reservation.appRequestId,
									error: error instanceof Error ? error.message : String(error),
									message: "quota.finalize.failed",
									reservationKey: reservation.reservationKey,
								}),
							).catch(() => undefined),
						);
					}),
				onError: (error: unknown) =>
					otelContext.with(traceContext, () => {
						runPromise(
							releaseAppRequestQuota({
								reservation,
								reason: "provider_failure",
							}),
						).catch((releaseError) =>
							runPromise(
								Effect.logError({
									appRequestId: reservation.appRequestId,
									error:
										releaseError instanceof Error
											? releaseError.message
											: String(releaseError),
									message: "quota.release.failed",
									reservationKey: reservation.reservationKey,
								}),
							).catch(() => undefined),
						);
						runPromise(
							Effect.logError({
								error: error instanceof Error ? error.message : String(error),
								message: "AI stream error",
							}),
						).catch(() => undefined);
						return streamErrorReason(error, "AI_STREAM_FAILED");
					}),
				messageMetadata: <Tools extends ToolSet>({
					part,
				}: {
					part: TextStreamPart<Tools>;
				}) => {
					if (part.type === "finish-step") {
						return {
							model: part.response.modelId,
						};
					}
					if (part.type === "finish") {
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

			const stream = yield* Effect.tryPromise({
				try: async () =>
					turnAgent.kind === "assistant"
						? createAgentUIStream({
								...turnStream,
								agent: turnAgent.agent,
								// An assistant conversation holds no knowledge-base tool parts.
								originalMessages: messages as AssistantAgentUIMessage[],
								experimental_transform: wordStream(),
							})
						: createAgentUIStream({
								...turnStream,
								agent: turnAgent.agent,
								originalMessages: messages,
								experimental_transform: wordStream(),
							}),
				catch: (cause) =>
					new AiError({
						operation: "aiChat.handler",
						cause,
					}),
			}).pipe(
				Effect.catch((error) =>
					Effect.all([
						releaseAppRequestQuota({
							reservation,
							reason: "app_failure",
						}).pipe(Effect.ignore),
						settleChatReply({
							id: assistantMessageId,
							chatId: input.chatId,
							parts: [],
							metadata: {},
						}).pipe(Effect.ignore),
					]).pipe(Effect.andThen(Effect.fail(error))),
				),
			);

			return streamToEventIterator(stream);
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.logError(`[ai.chat] handler failed ${Cause.pretty(cause)}`),
			),
		);
	});

export const aiRouter = {
	chat: aiChat,
};
