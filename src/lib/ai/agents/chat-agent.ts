import { type LanguageModel, Output, stepCountIs, ToolLoopAgent } from "ai";
import { buildKnowledgeBaseTools } from "@/lib/ai/tools/rag/toolset";
import type { DatabaseBlock, TemplateBlock } from "@/lib/orpc/schemas/block";

const chatAgentToolSet = buildKnowledgeBaseTools({
	blocks: [], // Placeholder, will be set in prepareCall
});

export const createChatAgent = (params: {
	model: LanguageModel;
	templateBlock: TemplateBlock;
	databaseBlocks: DatabaseBlock[];
}) =>
	new ToolLoopAgent({
		model: params.model,
		tools: chatAgentToolSet,
		prepareCall: ({ options, ...settings }) => {
			const tools =
				params.databaseBlocks.length > 0
					? buildKnowledgeBaseTools({
							blocks: params.databaseBlocks,
						})
					: undefined;

			return {
				...settings,
				instructions: [
					{
						role: "system",
						content:
							params.templateBlock.config.systemPrompt ??
							"You are a helpful assistant.",
					},
					{
						role: "system",
						content:
							"When using tools, keep retrieval efficient: run at most two searchKnowledgeBase calls before either fetching final chunks with getKnowledgeBaseChunks or explicitly saying you don't know. Avoid repeated searches that return no new evidence.",
					},
					{
						role: "system",
						content:
							"Use searchKnowledgeBase to shortlist candidates, then use getKnowledgeBaseChunks only for the few chunk IDs you need to ground your final answer. Cite chunk IDs in your final response when factual claims are made.",
					},
					{
						role: "system",
						content:
							"Cite sources in the format [source:id] when using information from retrieved chunks. For example, if you use information from a chunk with ID '3e4985a3-0d72-4084-98ff-5d669d9d95d6', include [source:3e4985a3-0d72-4084-98ff-5d669d9d95d6] in your response to indicate the source of that information.",
					},
					{
						role: "system",
						content:
							"For document-title or page-specific requests, first call listKnowledgeBaseDocuments, then call getKnowledgeBasePage (and optionally searchKnowledgeBase scoped by assetIds) before answering.",
					},
				],
				tools: tools,
				stopWhen: stepCountIs(10),
			};
		},
		output: Output.text(),
	});
