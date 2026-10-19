import { context as otelContext } from "@opentelemetry/api";
import { AiError } from "@orcai/ai";
import { DB, dbSchema } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import type { DatabaseBlock, TemplateBlock } from "@orcai/schema";
import { streamToEventIterator } from "@orpc/client";
import { call } from "@orpc/server";
import {
	createAgentUIStream,
	type FileUIPart,
	smoothStream,
	type TextUIPart,
} from "ai";
import { and, eq } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { forkChatTitleGenerationIfNeeded } from "@/lib/ai/effects/fork-chat-title-generation";
import { quotaDenialError } from "@/lib/ai/effects/generate-text-with-quota";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { streamErrorReason } from "@/lib/ai/utils/stream-error-reason";
import { getZedToken } from "@/lib/authz/zed-token";
import { runPromise } from "@/lib/effect/runtime";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { listChatBlocks } from "./chat-block";
import { createChatMessage } from "./chat-message";

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

const hasMessageShape = (
	value: unknown,
): value is {
	id?: string;
	role: string;
	parts: unknown[];
	metadata?: unknown;
	attachments?: unknown;
} =>
	isRecord(value) &&
	typeof value.role === "string" &&
	Array.isArray(value.parts);

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

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.use(
		requireEntityPermission("chat", "edit", {
			entityId: "chatId",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		return yield* Effect.gen(function* () {
			const zedToken = getZedToken(context, input);
			const requestContext = {
				...context,
				meta: {
					...context.meta,
					zedToken,
				},
			};
			const inputMessages = input.messages as ChatAgentUIMessage[];
			const userMessage = inputMessages[inputMessages.length - 1];

			if (!hasMessageShape(userMessage)) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "CHAT_MESSAGE_INVALID",
						message: "Missing or invalid user message",
					}),
				);
			}

			// Fetch chat record to get config + botId
			const db = yield* DB;
			const chatRecord = yield* db.query.chat
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
							Effect.mapError(
								() =>
									new AppErrors.NotFoundError({
										reason: "CHAT_NOT_FOUND",
										id: input.chatId,
										message: "Chat not found",
									}),
							),
						),
					),
				);

			const chatConfig = chatRecord.config;
			const providerId = chatConfig?.providerId;
			const modelId = chatConfig?.modelId;

			if (!providerId || !modelId) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "CHAT_MODEL_NOT_CONFIGURED",
						message:
							"Chat is missing model or provider configuration. Please select a model in chat settings.",
					}),
				);
			}

			const [chatModel] = yield* db
				.select({
					capabilities: dbSchema.model.capabilities,
				})
				.from(dbSchema.model)
				.innerJoin(
					dbSchema.provider,
					eq(dbSchema.provider.id, dbSchema.model.providerId),
				)
				.where(
					and(
						eq(dbSchema.model.id, modelId),
						eq(dbSchema.provider.id, providerId),
						eq(
							dbSchema.provider.organizationId,
							context.auth.session.activeOrganizationId,
						),
					),
				)
				.limit(1);

			if (!chatModel?.capabilities.includes("tool-calling")) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "MODEL_TOOLS_UNSUPPORTED",
						message:
							"Selected model does not support tool calling. Please choose a chat-capable model.",
					}),
				);
			}

			const chatBlocksResult = yield* Effect.tryPromise({
				try: async () =>
					call(
						listChatBlocks,
						{
							chatId: input.chatId,
							zedToken,
						},
						{
							context: requestContext,
						},
					),
				catch: (cause) =>
					new AppErrors.BadRequestError({
						reason: "CHAT_BLOCKS_UNAVAILABLE",
						message: "Failed to fetch chat blocks",
						cause,
					}),
			});
			const chatBlocks = chatBlocksResult.data;

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

			const assistantMessageId = uuidv4();

			const quotaReservation = yield* reserveForAppRequest({
				organizationId: context.auth.session.activeOrganizationId,
				userId: context.auth.user.id,
				providerId,
				providerModelId: modelId,
				appRequestId: assistantMessageId,
				messages: inputMessages,
				isFirstTurn: inputMessages.length < 2,
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
			const userMessageAttachments = getChatMessageAttachments(userMessage);

			const attachmentPartCache = new Map<string, FileUIPart | TextUIPart>();
			const messagesWithAttachmentParts = yield* Effect.forEach(
				inputMessages,
				(message) =>
					Effect.gen(function* () {
						if (!hasMessageShape(message) || message.role !== "user") {
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

			const { data: persistedUserMessage } = yield* Effect.tryPromise({
				try: async () =>
					call(
						createChatMessage,
						{
							id: uuidv4(),
							chatId: input.chatId,
							role: "user",
							parts: userMessage.parts,
							attachments: userMessageAttachments,
							metadata: (userMessage.metadata ?? {}) as Record<string, unknown>,
						},
						{
							context: requestContext,
						},
					),
				catch: (cause) =>
					new AppErrors.BadRequestError({
						reason: "CHAT_MESSAGE_CREATE_FAILED",
						message: "Failed to create user message",
						cause,
					}),
			}).pipe(
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

			yield* forkChatTitleGenerationIfNeeded({
				chatId: input.chatId,
				currentTitle: chatRecord.title,
				model: chatAiSettings.model,
				organizationId: context.auth.session.activeOrganizationId,
				providerId,
				providerModelId: modelId,
				userId: context.auth.user.id,
				userMessage: {
					id: persistedUserMessage.id,
					role: persistedUserMessage.role,
					parts: persistedUserMessage.parts,
				},
			});

			const agent = createChatAgent({
				model: chatAiSettings.model,
				systemPrompt,
				databaseBlocks: allDatabaseBlocks,
				generationParams: chatAiSettings.generationParams,
				telemetryIds: {
					organizationId: context.auth.session.activeOrganizationId,
					chatId: input.chatId,
					providerId,
					modelId,
				},
				context: requestContext,
			});

			let actualProviderRequestCount = 0;

			// The stream outlives the handler; its callbacks rejoin the request trace.
			const traceContext = otelContext.active();

			const stream = yield* Effect.tryPromise({
				try: async () =>
					createAgentUIStream({
						agent,
						uiMessages: messagesWithAttachmentParts,
						originalMessages: inputMessages,
						generateMessageId: () => assistantMessageId,
						experimental_transform: smoothStream({
							delayInMs: 20,
							chunking: "word",
						}),
						onStepEnd: () => {
							actualProviderRequestCount += 1;
						},
						onEnd: ({ responseMessage }) =>
							otelContext.with(traceContext, async () => {
								const usage = getTokenUsageFromMetadata(
									responseMessage.metadata,
								);

								await call(
									createChatMessage,
									{
										id: responseMessage.id,
										chatId: input.chatId,
										role: responseMessage.role,
										parts: responseMessage.parts,
										attachments: [],
										metadata: (responseMessage.metadata ?? {}) as Record<
											string,
											unknown
										>,
									},
									{
										context: requestContext,
									},
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
											error:
												error instanceof Error ? error.message : String(error),
											message: "quota.finalize.failed",
											reservationKey: reservation.reservationKey,
										}),
									).catch(() => undefined),
								);
							}),
						onError: (error) =>
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
										error:
											error instanceof Error ? error.message : String(error),
										message: "AI stream error",
									}),
								).catch(() => undefined);
								return streamErrorReason(error, "AI_STREAM_FAILED");
							}),
						messageMetadata: ({ part }) => {
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
					}),
				catch: (cause) =>
					new AiError({
						operation: "aiChat.handler",
						cause,
					}),
			}).pipe(
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

			return streamToEventIterator(stream);
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.logError(`[ai.chat] handler failed ${Cause.pretty(cause)}`),
			),
		);
	});
