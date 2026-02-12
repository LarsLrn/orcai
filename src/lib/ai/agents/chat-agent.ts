import { type LanguageModel, Output, stepCountIs, ToolLoopAgent } from "ai";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { searchKnowledgeBaseTool } from "@/lib/ai/tools/search-knowledgebase";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { runtime } from "@/lib/effect/runtime";
import { AiError } from "@/lib/effect/utils/errors";
import { logger } from "@/lib/observability/logger";
import { blockSelectSchema } from "@/lib/orpc/schemas/block";

const chatAgentToolSet = {
	searchKnowledgeBase: searchKnowledgeBaseTool({
		block: undefined, // Placeholder, will be set in prepareCall
	}),
};

export const chatAgent = new ToolLoopAgent({
	model: {} as unknown as LanguageModel, // Placeholder, will be set in prepareCall
	tools: chatAgentToolSet,
	callOptionsSchema: z.object({
		blocks: z.array(blockSelectSchema),
	}),
	prepareCall: async ({ options, ...settings }) =>
		runtime.runPromise(
			Effect.gen(function* () {
				const templateBlock = options.blocks.find(
					(block) => block.type === "template",
				);

				if (!templateBlock) {
					return yield* new AiError({
						operation: "chatAgent.prepareCall",
						cause: new Error("No template block found for chat agent."),
					});
				}

				const databaseBlocks = options.blocks.filter(
					(block) => block.type === "database",
				);

				const chatAiSettings = yield* getChatAiSettings({ templateBlock });

				return {
					...settings,
					model: chatAiSettings.model,
					instructions: [
						{
							role: "system",
							content:
								templateBlock.config.systemPrompt ??
								"You are a helpful assistant.",
						},
						{
							role: "system",
							content:
								"When using tools, avoid generating additional text outside of tool calls. Focus on utilizing the tools effectively to provide accurate and relevant responses. Only give a final answer when you are certain of the information.",
						},
					],
					tools: {
						/* ...(imageGenerationBlock && {
					generateImage: generateImageTool({
						writer,
						block: imageGenerationBlock,
						organizationId: context.auth.session.activeOrganizationId,
					}),
				}), */
						searchKnowledgeBase: searchKnowledgeBaseTool({
							block: databaseBlocks[0], // TODO: Support multiple databases
						}),
					},
					stopWhen: stepCountIs(10),
				};
			}),
		),
	onStepFinish: (step) => {
		logger.info({ reason: step.rawFinishReason }, "Chat agent step finished");
	},
	output: Output.text(),
});
