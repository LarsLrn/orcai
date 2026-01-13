import type { InferUITool, ToolUIPart } from "ai";
import type { generateImageTool } from "@/lib/ai/tools/generate-image";
import type { searchKnowledgeBaseTool } from "@/lib/ai/tools/search-knowledgebase";

/**
 * Search Knowledge Base Tool Part
 */
type SearchKnowledgeBaseUITool = InferUITool<
	ReturnType<typeof searchKnowledgeBaseTool>
>;
export type SearchKnowledgeBaseToolPart = ToolUIPart<{
	searchKnowledgeBase: SearchKnowledgeBaseUITool;
}>;

/**
 * Image Generation Tool Part
 */

type GenerateImageUITool = InferUITool<ReturnType<typeof generateImageTool>>;
export type GenerateImageToolPart = ToolUIPart<{
	generateImage: GenerateImageUITool;
}>;
