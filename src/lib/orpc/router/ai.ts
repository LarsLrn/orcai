import { ORPCError, streamToEventIterator } from "@orpc/client";
import { createAgentUIStream, smoothStream } from "ai";
import { v4 as uuidv4 } from "uuid";
import { chatAgent } from "@/lib/ai/agents/chat-agent";
import { generateChatTitle } from "@/lib/ai/generate-chat-title";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { client } from "@/lib/orpc/orpc";

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input }) => {
		try {
			const userMessage = input.messages[input.messages.length - 1];

			// Determine parent ID if this is a regeneration/branching
			// If we have >1 messages, the parent of the new message is the second to last message
			const parentMessageId =
				input.messages.length > 1
					? input.messages[input.messages.length - 2].id
					: undefined;

			// Create initial user message in the correct branch or new branch
			const { branchId: currentBranchId } = await client.chatMessage.create({
				id: uuidv4(),
				chatId: input.chatId,
				role: "user",
				parts: userMessage.parts,
				attachments: [],
				metadata: userMessage.metadata || {},
				branchId: input.branchId,
				parentMessageId, // Identify where we are attaching this message
			});

			if (input.messages.length < 2) {
				client.chat.update({
					id: input.chatId,
					title: (await generateChatTitle({ messages: input.messages })).title,
				});
			}

			const assistantMessageId = uuidv4();

			if (!input.botId)
				throw new ORPCError("BAD_REQUEST", {
					message: "botId is required.",
				});

			const blocks = await client.block.list({
				filters: { botId: input.botId },
			});

			const stream = await createAgentUIStream({
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
					console.log("AI response finished, saving message...");
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
				onError: (error) => {
					console.error("Error in data stream execution:", error);
					return "Oops, an error occurred while processing your request!";
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
			});

			return streamToEventIterator(stream);
		} catch (error) {
			console.error("Error in AI chat handler:", error);

			if (error instanceof ORPCError) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: `An error occurred while processing your request: ${error.message}`,
				});
			}
		}
	});
