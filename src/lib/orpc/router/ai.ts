import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ORPCError, streamToEventIterator } from "@orpc/client";
import {
	convertToModelMessages,
	createUIMessageStream,
	extractReasoningMiddleware,
	smoothStream,
	stepCountIs,
	streamText,
	wrapLanguageModel,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { generateChatTitle } from "@/lib/ai/generate-chat-title";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { searchKnowledgeBaseTool } from "@/lib/ai/tools/search-knowledgebase";
import { decryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { client } from "@/lib/orpc/orpc";
import type {
	DatabaseBlock,
	ImageGenerationBlock,
	TemplateBlock,
} from "@/lib/orpc/schemas/block";

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ context, input }) => {
		try {
			const userMessage = input.messages[input.messages.length - 1];

			client.chatMessage.create({
				id: uuidv4(),
				chatId: input.chatId,
				role: "user",
				parts: userMessage.parts,
				attachments: [],
				metadata: userMessage.metadata || {},
			});

			if (input.messages.length < 2) {
				client.chat.update({
					id: input.chatId,
					title: (await generateChatTitle({ messages: input.messages })).title,
				});
			}

			let templateBlock: TemplateBlock | undefined;
			let imageGenerationBlock: ImageGenerationBlock | undefined;
			let databaseBlocks: DatabaseBlock[] = [];

			// If provided, fetch the bot to get its model configuration
			if (input.botId) {
				const botBlocks = await client.block.list({
					filters: { botId: input.botId },
				});

				templateBlock = botBlocks.data.find(
					(block) => block.type === "template",
				);

				imageGenerationBlock = botBlocks.data.find(
					(block) => block.type === "imageGeneration",
				);

				databaseBlocks = botBlocks.data.filter(
					(block) => block.type === "database",
				);
			}

			if (!templateBlock) {
				throw new ORPCError("BAD_REQUEST", {
					message: "No valid template block found.",
				});
			}

			const systemProvider = await client.provider.find({
				slug: templateBlock.config.provider,
			});

			const organizationProvider = await client.organizationProvider.find({
				providerSlug: templateBlock.config.provider,
			});

			const chatProvider = createOpenAICompatible({
				baseURL: systemProvider.data.endpoint ?? "", // TODO: Fix?
				apiKey: decryptApiKey(organizationProvider.data.apiKeyEncrypted),
				name: systemProvider.data.slug,
				includeUsage: true,
			});

			// Only wrap if the model has reasoning capabilities
			const model = wrapLanguageModel({
				model: chatProvider(templateBlock.config.model),
				middleware: extractReasoningMiddleware({ tagName: "think" }),
			});

			const assistantMessageId = uuidv4();

			const stream = createUIMessageStream({
				generateId: () => assistantMessageId,
				originalMessages: input.messages,
				execute: ({ writer }) => {
					const result = streamText({
						model,
						system:
							templateBlock.config.systemPrompt ??
							"You are a helpful assistant.",
						messages: convertToModelMessages(input.messages),
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
						stopWhen: stepCountIs(5),
						tools: {
							...(imageGenerationBlock && {
								generateImage: generateImageTool({
									writer,
									block: imageGenerationBlock,
									organizationId: context.auth.session.activeOrganizationId,
								}),
							}),
							...(databaseBlocks.length > 0 && {
								searchKnowledgeBase: searchKnowledgeBaseTool({
									block: databaseBlocks[0], // TODO: Support multiple databases
								}),
							}),
						},
					});

					writer.merge(
						result.toUIMessageStream({
							sendReasoning: true,
							messageMetadata: ({ part }) => {
								if (part.type === "start") {
									return {
										model: model.modelId,
									};
								}
								if (part.type === "finish") {
									return {
										totalUsage: part.totalUsage,
									};
								}
							},
						}),
					);
				},
				onFinish: ({ responseMessage }) => {
					client.chatMessage.create({
						id: responseMessage.id,
						chatId: input.chatId,
						role: responseMessage.role,
						parts: responseMessage.parts,
						attachments: [],
						metadata: responseMessage.metadata,
					});
				},
				onError: (error) => {
					console.error("Error in data stream execution:", error);
					return "Oops, an error occurred while processing your request!";
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
