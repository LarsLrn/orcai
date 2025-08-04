import { createOpenAI } from "@ai-sdk/openai";
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
import type { TemplateBlock } from "@/db/schema/block";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { decryptApiKey } from "@/lib/encryption";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { retry } from "@/lib/orpc/middlewares/retry";
import { client } from "@/lib/orpc/orpc";
import { authed } from "..";

export const aiChat = authed.ai.chat
	.use(requireActiveOrganizationMiddleware)
	.use(retry({ times: 3 }))
	.handler(async ({ context, input }) => {
		try {
			const userMessage = input.messages[input.messages.length - 1];

			client.chatMessage.create({
				id: uuidv4(),
				chatId: input.chatId,
				role: "user",
				parts: userMessage.parts,
				attachments: [],
				annotations: [],
			});

			let templateBlock: TemplateBlock | undefined;

			if (input.botId) {
				// Fetch the bot to get its model configuration
				const bot = await client.bot.find({
					id: input.botId,
				});

				// TODO: Improve typesafety. Probably with some Zod validation
				templateBlock = bot.data.blocks.find(
					(block) => block.type === "template",
				) as TemplateBlock;
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

			const chatProvider = createOpenAI({
				baseURL: systemProvider.data.endpoint ?? undefined,
				apiKey: decryptApiKey(organizationProvider.data.apiKeyEncrypted),
				name: systemProvider.data.slug,
			}).chat;

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
					/* references.forEach((reference) => {
            dataStream.writeMessageAnnotation(reference as unknown as JSONValue);
          }); */

					// Validate and get the model ID from course configuration
					console.log(assistantMessageId);
					const result = streamText({
						/* model: model, */
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
						system: "You are a helpful assistant.",
						messages: convertToModelMessages(input.messages),
						experimental_transform: smoothStream({ chunking: "word" }),
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
								assistantMessageId,
							}),
							/* generateJoke: generateJokeTool(),
              searchKnowledgeBase: searchKnowledgeBaseTool({
                config: course.data.config,
                courseId: activeCourseId,
              }), */
						},
						/* onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === "assistant",
                    ),
                  });
    
                  if (!assistantId) {
                    throw new Error("No assistant message found!");
                  }
    
                  const [, assistantMessage] = appendResponseMessages({
                    messages: [userMessage],
                    responseMessages: response.messages,
                  });
    
                  const filteredParts = assistantMessage.parts?.filter((part) => {
                    if (
                      part.type === "tool-invocation" &&
                      part.toolInvocation.toolName === "searchKnowledgeBase"
                    ) {
                      return false; // Exclude tool invocations from the parts
                    }
                    return true; // Include all other parts
                  });
    
                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId,
                        role: assistantMessage.role,
                        // parts: assistantMessage.parts,
                        parts: filteredParts ?? [],
                        annotations: references ?? [],
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                      },
                    ],
                  });
                } catch (error) {
                  console.error("Error saving assistant message:", error);
                }
              }
            }, */
					});

					writer.merge(result.toUIMessageStream());
				},
				onFinish: ({ responseMessage }) => {
					client.chatMessage.create({
						id: responseMessage.id,
						chatId: input.chatId,
						role: responseMessage.role,
						parts: responseMessage.parts,
						attachments: [],
						annotations: [],
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
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "An error occurred while processing your request.",
			});
		}
	});
