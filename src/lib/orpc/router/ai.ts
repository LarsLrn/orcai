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
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { searchKnowledgeBaseTool } from "@/lib/ai/tools/search-knowledgebase";
import { decryptApiKey } from "@/lib/encryption";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { client } from "@/lib/orpc/orpc";
import type { DatabaseBlock, TemplateBlock } from "@/lib/orpc/schemas/block";

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

			let templateBlock: TemplateBlock | undefined;
			let databaseBlock: DatabaseBlock | undefined;

			if (input.botId) {
				// Fetch the bot to get its model configuration
				const botBlocks = await client.block.list({
					filters: { botId: input.botId },
				});

				// TODO: Improve typesafety. Probably with some Zod validation
				templateBlock = botBlocks.data.find(
					(block) => block.type === "template",
				) as TemplateBlock;

				databaseBlock = botBlocks.data.find(
					(block) => block.type === "database",
				) as DatabaseBlock;
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
				organizationId: context.auth.session.activeOrganizationId,
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
						/* system: createSocraticSystemPrompt({
              context: relevantChunks.map((chunk) => ({
                documentId: String(
                  references.indexOf(
                    references.find((r) => r.id === chunk.documentId)!,
                  ) + 1,
                ),
                text: chunk.text,
              })),
              courseTitle: course.data.title,
              override: course.data.config.systemPrompt,
            }), */
						system:
							templateBlock.config.systemPrompt ??
							"You are a helpful assistant.",
						messages: convertToModelMessages(input.messages),
						experimental_transform: smoothStream({
							delayInMs: 20,
							chunking: "line",
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
							generateImage: generateImageTool({
								writer,
							}),
							...(databaseBlock && {
								searchKnowledgeBase: searchKnowledgeBaseTool({
									block: databaseBlock,
								}),
							}),
							/* generateJoke: generateJokeTool(),
              searchKnowledgeBase: searchKnowledgeBaseTool({
                config: course.data.config,
                courseId: activeCourseId,
              }), */
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
