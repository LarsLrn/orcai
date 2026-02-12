import { streamToEventIterator } from "@orpc/client";
import { createAgentUIStream, smoothStream } from "ai";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { chatAgent } from "@/lib/ai/agents/chat-agent";
import { generateChatTitle } from "@/lib/ai/generate-chat-title";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { client } from "@/lib/orpc/orpc";

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const userMessage = input.messages[input.messages.length - 1];

				const parentMessageId =
					input.messages.length > 1
						? input.messages[input.messages.length - 2].id
						: undefined;

				const { branchId: currentBranchId } = yield* Effect.tryPromise({
					try: async () =>
						client.chatMessage.create({
							id: uuidv4(),
							chatId: input.chatId,
							role: "user",
							parts: userMessage.parts,
							attachments: [],
							metadata: userMessage.metadata || {},
							branchId: input.branchId,
							parentMessageId, // Identify where we are attaching this message
						}),
					catch: () =>
						errors.BAD_REQUEST({ message: "Failed to create user message" }),
				});

				if (input.messages.length < 2) {
					yield* generateChatTitle({ messages: input.messages }).pipe(
						Effect.flatMap(({ title }) =>
							Effect.tryPromise({
								try: async () =>
									client.chat.update({
										id: input.chatId,
										title,
									}),
								catch: () =>
									errors.BAD_REQUEST({
										message: "Failed to update chat title",
									}),
							}),
						),
					);
				}

				const assistantMessageId = uuidv4();

				const botId = yield* Effect.fromNullable(input.botId).pipe(
					Effect.mapError(() =>
						errors.BAD_REQUEST({ message: "botId is required" }),
					),
				);

				const blocks = yield* Effect.tryPromise({
					try: async () =>
						client.block.list({
							filters: { botId },
						}),
					catch: () =>
						errors.BAD_REQUEST({ message: "Failed to fetch blocks for bot" }),
				});

				const stream = yield* Effect.tryPromise({
					try: async () =>
						createAgentUIStream({
							agent: chatAgent,
							uiMessages: input.messages,
							originalMessages: input.messages,
							options: {
								blocks: blocks.data,
							},
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
								await client.chatMessage.create({
									id: responseMessage.id,
									chatId: input.chatId,
									role: responseMessage.role,
									parts: responseMessage.parts,
									attachments: [],
									metadata: responseMessage.metadata ?? {},
									branchId: currentBranchId,
								});
							},
							onError: () =>
								"Oops, an error occurred while processing your request!",
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

					catch: () =>
						errors.BAD_REQUEST({
							message: "Failed to create agent UI stream",
						}),
				});

				return streamToEventIterator(stream);
			}),
		),
	);
