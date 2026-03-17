import { streamToEventIterator } from "@orpc/client";
import { call } from "@orpc/server";
import {
	createAgentUIStream,
	type FileUIPart,
	smoothStream,
	type TextUIPart,
} from "ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { generateChatTitle } from "@/lib/ai/generate-chat-title";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { runtime } from "@/lib/effect/runtime";
import { DB } from "@/lib/effect/services/drizzle";
import { AiError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import type { DatabaseBlock, TemplateBlock } from "@/lib/orpc/schemas/block";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@/lib/quota/enforcement";
import { updateChat } from "./chat";
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
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				permission: "edit",
				entityType: "chat",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const resolvedZedToken = input.zedToken ?? context.meta?.zedToken;
				const requestContext = {
					...context,
					meta: {
						...context.meta,
						zedToken: resolvedZedToken,
					},
				};
				const inputMessages = Array.isArray(input.messages)
					? input.messages
					: [];
				const userMessage = inputMessages[inputMessages.length - 1];

				if (!hasMessageShape(userMessage)) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "Missing or invalid user message",
						}),
					);
				}

				// Fetch chat record to get config + botId
				const db = yield* DB;
				const chatRecord = yield* db.query.chat
					.findFirst({
						where: {
							id: input.chatId,
						},
					})
					.pipe(
						Effect.flatMap((chat) =>
							Effect.fromNullable(chat).pipe(
								Effect.mapError(() =>
									errors.BAD_REQUEST({
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
						errors.BAD_REQUEST({
							message:
								"Chat is missing model or provider configuration. Please select a model in chat settings.",
						}),
					);
				}

				const chatBlocksResult = yield* Effect.tryPromise({
					try: async () =>
						call(
							listChatBlocks,
							{
								chatId: input.chatId,
								zedToken: resolvedZedToken,
							},
							{
								context: requestContext,
							},
						),
					catch: () =>
						errors.BAD_REQUEST({
							message: "Failed to fetch chat blocks",
						}),
				});
				const chatBlocks = chatBlocksResult.data;

				const chatAiSettings = yield* getChatAiSettings({
					providerId,
					modelId,
					botId: chatRecord.botId,
					chatConfig,
					userId: context.auth.user.id,
					zedToken: resolvedZedToken,
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
					orgId: context.auth.session.activeOrganizationId,
					userId: context.auth.user.id,
					providerId,
					providerModelId: modelId,
					appRequestId: assistantMessageId,
					messages: inputMessages,
					isFirstTurn: inputMessages.length < 2,
				});

				if (!quotaReservation.allowed || !quotaReservation.reservation) {
					const denialReason = quotaReservation.denialReason ?? "error";
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								denialReason === "no_pool"
									? "No quota pool available for this request."
									: denialReason === "exhausted"
										? "Quota exhausted for this provider/model."
										: "Quota check failed.",
						}),
					);
				}

				const userMessageAttachments = getChatMessageAttachments(userMessage);

				const parentMessageId =
					inputMessages.length > 1
						? inputMessages[inputMessages.length - 2]?.id
						: undefined;

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

				const { branchId: currentBranchId } = yield* Effect.tryPromise({
					try: async () =>
						call(
							createChatMessage,
							{
								id: uuidv4(),
								chatId: input.chatId,
								role: "user",
								parts: userMessage.parts,
								attachments: userMessageAttachments,
								metadata: userMessage.metadata || {},
								branchId: input.branchId,
								parentMessageId,
							},
							{
								context: requestContext,
							},
						),
					catch: () =>
						errors.BAD_REQUEST({
							message: "Failed to create user message",
						}),
				}).pipe(
					Effect.catchAll((error) =>
						releaseAppRequestQuota({
							reservation: quotaReservation.reservation,
							reason: "app_failure",
						}).pipe(
							Effect.catchAll(() => Effect.void),
							Effect.zipRight(Effect.fail(error)),
						),
					),
				);

				let titleRequestCount = 0;
				if (inputMessages.length < 2) {
					const titleResult = yield* generateChatTitle({
						messages: inputMessages,
						model: chatAiSettings.model,
					}).pipe(
						Effect.flatMap(({ title }) =>
							Effect.tryPromise({
								try: async () =>
									call(
										updateChat,
										{
											id: input.chatId,
											title,
										},
										{
											context: requestContext,
										},
									),
								catch: () =>
									errors.BAD_REQUEST({
										message: "Failed to update chat title",
									}),
							}).pipe(
								Effect.as({
									success: true as const,
								}),
							),
						),
						Effect.catchAll((error) =>
							Effect.logWarning({
								chatId: input.chatId,
								error,
								message: "ai.chat title generation failed, continuing",
							}).pipe(
								Effect.as({
									success: false as const,
								}),
							),
						),
					);
					titleRequestCount = titleResult.success ? 1 : 0;
				}

				const agent = createChatAgent({
					model: chatAiSettings.model,
					systemPrompt,
					databaseBlocks: allDatabaseBlocks,
					generationParams: chatAiSettings.generationParams,
				});

				let actualProviderRequestCount = titleRequestCount;

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
							onStepFinish: () => {
								actualProviderRequestCount += 1;
							},
							onFinish: async ({ responseMessage }) => {
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
										metadata: responseMessage.metadata ?? {},
										branchId: currentBranchId,
									},
									{
										context: requestContext,
									},
								);

								await runtime
									.runPromise(
										finalizeAppRequestQuota({
											reservation: quotaReservation.reservation,
											actualRequestCount: actualProviderRequestCount,
											inputTokens: usage.inputTokens,
											outputTokens: usage.outputTokens,
											totalTokens: usage.totalTokens,
										}),
									)
									.catch((error) =>
										runtime
											.runPromise(
												Effect.logError({
													appRequestId:
														quotaReservation.reservation.appRequestId,
													error:
														error instanceof Error
															? error.message
															: String(error),
													message: "quota.finalize.failed",
													reservationKey:
														quotaReservation.reservation.reservationKey,
												}),
											)
											.catch(() => undefined),
									);
							},
							onError: (error) => {
								runtime
									.runPromise(
										releaseAppRequestQuota({
											reservation: quotaReservation.reservation,
											reason: "provider_failure",
										}),
									)
									.catch((releaseError) =>
										runtime
											.runPromise(
												Effect.logError({
													appRequestId:
														quotaReservation.reservation.appRequestId,
													error:
														releaseError instanceof Error
															? releaseError.message
															: String(releaseError),
													message: "quota.release.failed",
													reservationKey:
														quotaReservation.reservation.reservationKey,
												}),
											)
											.catch(() => undefined),
									);
								runtime
									.runPromise(
										Effect.logError({
											error:
												error instanceof Error ? error.message : String(error),
											message: "AI stream error",
										}),
									)
									.catch(() => undefined);
								return "An error occurred while streaming the AI response.";
							},
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
					Effect.catchAll((error) =>
						releaseAppRequestQuota({
							reservation: quotaReservation.reservation,
							reason: "app_failure",
						}).pipe(
							Effect.catchAll(() => Effect.void),
							Effect.zipRight(Effect.fail(error)),
						),
					),
				);

				return streamToEventIterator(stream);
			}).pipe(
				Effect.tapErrorCause((cause) =>
					Effect.logError(`[ai.chat] handler failed ${Cause.pretty(cause)}`),
				),
			),
		),
	);
