import { type LanguageModel, Output, stepCountIs, ToolLoopAgent } from "ai";
import z from "zod/v4";
import { searchKnowledgeBaseTool } from "@/lib/ai/tools/search-knowledgebase";
import { getChatAiSettings } from "@/lib/ai/utils/get-chat-ai-settings";
import { blockSelectSchema } from "@/lib/orpc/schemas/block";

export const chatAgentToolSet = {
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
	prepareCall: async ({ options, ...settings }) => {
		const templateBlock = options.blocks.find(
			(block) => block.type === "template",
		);

		if (!templateBlock) {
			throw new Error("No template block found for chat agent.");
		}

		const databaseBlocks = options.blocks.filter(
			(block) => block.type === "database",
		);

		return {
			...settings,
			model: (await getChatAiSettings({ templateBlock })).model,
			instructions: [
				{
					role: "system",
					content:
						templateBlock.config.systemPrompt ?? "You are a helpful assistant.",
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
	},
	onStepFinish: (step) => {
		console.log("Step finished:", step.rawFinishReason);
	},
	output: Output.text(),
});
