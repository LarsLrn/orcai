import { createOpenAI } from "@ai-sdk/openai";
import { streamToEventIterator } from "@orpc/client";
import {
	convertToModelMessages,
	createUIMessageStream,
	smoothStream,
	stepCountIs,
	streamText,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { decryptApiKey } from "@/lib/encryption";
import { retry } from "@/lib/orpc/middlewares/retry";
import { authed } from "..";
import { client } from "../orpc";

export const aiChat = authed.ai.chat
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		let modelId: string;

		const systemProvider = await client.provider.find({
			slug: "saia",
		});

		const organizationProvider = await client.organizationProvider.find({
			organizationId: "0451b241-37fb-4fd6-95e0-652191d9b484",
			providerSlug: "saia",
		});

		if (input.botId) {
			// Fetch the bot to get its model configuration
			const bot = await client.bot.find({
				id: input.botId,
			});

			// TODO: Improve typesafety. Probably with some Zod validation
			modelId =
				bot.data.blocks.find((block) => block.type === "template")?.config
					.model ?? "meta-llama-3.1-8b-instruct";
		}

		const chatProvider = createOpenAI({
			baseURL: systemProvider.data.endpoint ?? undefined,
			apiKey: decryptApiKey(organizationProvider.data.apiKeyEncrypted),
			name: systemProvider.data.slug,
		}).chat;

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
					model: chatProvider(modelId),
					/* system: createSocraticSystemPrompt({
              context: relevantChunks.map((chunk) => ({
                documentId: String(
                  references.indexOf(
                    // biome-ignore lint/style/noNonNullAssertion: <Previously ensured to exist>
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
			onFinish: ({ messages }) => {
				console.log("Stream finished with messages:", messages);
			},
			onError: (error) => {
				console.error("Error in data stream execution:", error);
				return "Oops, an error occurred while processing your request!";
			},
		});

		return streamToEventIterator(stream);
	});
