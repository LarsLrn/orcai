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
import { AiError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { updateChat } from "./chat";
import { createChatMessage } from "./chat-message";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

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
				});

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
					);
				}

				const assistantMessageId = uuidv4();

				const agent = createChatAgent({
					model: chatAiSettings.model,
					templateBlock: chatAiSettings.templateBlock,
					databaseBlocks: chatAiSettings.databaseBlocks,
				});

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
				});

				return streamToEventIterator(stream);
			}),
		),
	);
