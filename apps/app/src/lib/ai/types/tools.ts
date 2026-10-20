import type { InferUITool, ToolUIPart } from "ai";
import type { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { getKnowledgeBaseChunksTool } from "@/lib/ai/tools/rag/get-knowledge-base-chunk";
import type { getKnowledgeBasePageTool } from "@/lib/ai/tools/rag/get-knowledge-base-page";
import type { listKnowledgeBaseDocumentsTool } from "@/lib/ai/tools/rag/list-knowledge-base-documents";
import type { searchKnowledgeBaseTool } from "@/lib/ai/tools/rag/search-knowledge-base";

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
