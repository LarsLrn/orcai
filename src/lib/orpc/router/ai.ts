import { streamToEventIterator } from "@orpc/client";
import { call } from "@orpc/server";
import {
	createAgentUIStream,
	type FileUIPart,
	smoothStream,
	type TextUIPart,
} from "ai";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { generateChatTitle } from "@/lib/ai/generate-chat-title";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { runtime } from "@/lib/effect/runtime";
import { AiError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@/lib/quota/enforcement";
import { updateChat } from "./chat";
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

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, errors, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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

				const botId = yield* Effect.fromNullable(input.botId).pipe(
					Effect.mapError(() =>
						errors.BAD_REQUEST({
							message: "botId is required",
						}),
					),
				);

				const chatAiSettings = yield* getChatAiSettings({
					botId,
				});

				const assistantMessageId = uuidv4();

				const quotaReservation = yield* reserveForAppRequest({
					orgId: context.auth.session.activeOrganizationId,
					userId: context.auth.user.id,
					providerId: chatAiSettings.templateBlock.config.provider,
					providerModelId: chatAiSettings.templateBlock.config.model,
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

				// TODO: Currently halts streaming, until attachments are processed. Since PDFs call docling for conversion, this should be done optimistically on upload where possible, storing .md in S3 and reusing that.
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
								parentMessageId, // Identify where we are attaching this message
							},
							{
								context,
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
					yield* generateChatTitle({
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
											context,
										},
									),
								catch: () =>
									errors.BAD_REQUEST({
										message: "Failed to update chat title",
									}),
							}),
						),
						Effect.catchAll((error) =>
							releaseAppRequestQuota({
								reservation: quotaReservation.reservation,
								reason: "provider_failure",
							}).pipe(
								Effect.catchAll(() => Effect.void),
								Effect.zipRight(Effect.fail(error)),
							),
						),
					);
					titleRequestCount = 1;
				}

				const agent = createChatAgent({
					model: chatAiSettings.model,
					templateBlock: chatAiSettings.templateBlock,
					databaseBlocks: chatAiSettings.databaseBlocks,
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
							/* experimental_telemetry: {
								isEnabled: true,
								metadata: {
									langfuseTraceId: assistantMessageId,
									sessionId: chatId,
									courseId: activeCourseId,
									userId: session.user.id,
									tags: ["user", "chat"],
								},
							}, */
							onFinish: async ({ responseMessage }) => {
								const usage = getTokenUsageFromMetadata(
									responseMessage.metadata,
								);

								// Consider adding an Effect adapter to interface with AI SDK callbacks
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
										context,
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
									.catch((error) => {
										console.error(
											`quota.finalize.failed reservationKey=${quotaReservation.reservation.reservationKey} appRequestId=${quotaReservation.reservation.appRequestId}`,
											error,
										);
									});
							},
							onError: (error) => {
								runtime
									.runPromise(
										releaseAppRequestQuota({
											reservation: quotaReservation.reservation,
											reason: "provider_failure",
										}),
									)
									.catch((releaseError) => {
										console.error(
											`quota.release.failed reservationKey=${quotaReservation.reservation.reservationKey} appRequestId=${quotaReservation.reservation.appRequestId}`,
											releaseError,
										);
									});
								console.error("AI stream error", error);
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
			}),
		),
	);
