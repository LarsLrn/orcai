import { createServerFileRoute } from "@tanstack/react-start/server";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	smoothStream,
	stepCountIs,
	streamText,
	type UIMessage,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import {
	getSaiaModel,
	type ModelsWithText,
	saiaModels,
} from "@/lib/ai/saia-models";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { client } from "@/lib/orpc/orpc";

export const ServerRoute = createServerFileRoute("/api/ai/chat").methods({
	POST: ChatCompletion,
});

async function ChatCompletion({ request }: { request: Request }) {
	const { id: chatId, messages }: { id: string; messages: Array<UIMessage> } =
		await request.json();

	console.log("Messages received:", messages);

	const activeCourseId = "1db469a0-3f64-4395-9430-ae64dee30523";

	const course = await client.course.find({
		id: activeCourseId,
	});

	const modelIdFromConfig = course.data.config.model;
	const isValidModelId = saiaModels.some((m) => m.id === modelIdFromConfig);

	const { provider: modelProvider } = getSaiaModel({
		input: ["text"], // User only sends text
		model: isValidModelId
			? (modelIdFromConfig as ModelsWithText)
			: "llama-3.3-70b-instruct",
	});

	const assistantMessageId = uuidv4();

	const response = createUIMessageStreamResponse({
		status: 200,
		statusText: "OK",
		stream: createUIMessageStream({
			generateId: () => assistantMessageId,
			originalMessages: messages,
			execute: ({ writer }) => {
				/* references.forEach((reference) => {
				dataStream.writeMessageAnnotation(reference as unknown as JSONValue);
			}); */

				// Validate and get the model ID from course configuration
				console.log(assistantMessageId);
				const result = streamText({
					model: modelProvider,
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
					messages: convertToModelMessages(messages),
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
		}),
	});

	return response;
}
