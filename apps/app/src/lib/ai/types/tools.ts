import type { InferUITool, ToolUIPart } from "ai";
import type { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { getKnowledgeBaseChunksTool } from "@/lib/ai/tools/rag/get-knowledge-base-chunk";
import type { getKnowledgeBasePageTool } from "@/lib/ai/tools/rag/get-knowledge-base-page";
import type { listKnowledgeBaseDocumentsTool } from "@/lib/ai/tools/rag/list-knowledge-base-documents";
import type { searchKnowledgeBaseTool } from "@/lib/ai/tools/rag/search-knowledge-base";
import type { searchWebTool } from "@/lib/ai/tools/web/search-web";

/**
 * Search Knowledge Base Tool Part
 */
type SearchKnowledgeBaseUITool = InferUITool<
	ReturnType<typeof searchKnowledgeBaseTool>
>;
export type SearchKnowledgeBaseToolPart = ToolUIPart<{
	searchKnowledgeBase: SearchKnowledgeBaseUITool;
}>;

type GetKnowledgeBaseChunksUITool = InferUITool<
	ReturnType<typeof getKnowledgeBaseChunksTool>
>;
export type GetKnowledgeBaseChunksToolPart = ToolUIPart<{
	getKnowledgeBaseChunks: GetKnowledgeBaseChunksUITool;
}>;

type ListKnowledgeBaseDocumentsUITool = InferUITool<
	ReturnType<typeof listKnowledgeBaseDocumentsTool>
>;
export type ListKnowledgeBaseDocumentsToolPart = ToolUIPart<{
	listKnowledgeBaseDocuments: ListKnowledgeBaseDocumentsUITool;
}>;

type GetKnowledgeBasePageUITool = InferUITool<
	ReturnType<typeof getKnowledgeBasePageTool>
>;
export type GetKnowledgeBasePageToolPart = ToolUIPart<{
	getKnowledgeBasePage: GetKnowledgeBasePageUITool;
}>;

/**
 * Docs Tool Part
 */

type ReadDocsUITool = InferUITool<ReturnType<typeof readDocsTool>>;
export type ReadDocsToolPart = ToolUIPart<{
	readDocs: ReadDocsUITool;
}>;

type SearchWebUITool = InferUITool<ReturnType<typeof searchWebTool>>;
export type SearchWebToolPart = ToolUIPart<{
	searchWeb: SearchWebUITool;
}>;

/** The model provider's own search; its input and output differ by provider. */
export type NativeWebSearchToolPart = ToolUIPart<{
	web_search: {
		input: unknown;
		output: unknown;
	};
}>;
