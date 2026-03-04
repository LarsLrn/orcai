import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { getKnowledgeBaseChunksTool } from "./get-knowledge-base-chunk";
import { getKnowledgeBasePageTool } from "./get-knowledge-base-page";
import { listKnowledgeBaseDocumentsTool } from "./list-knowledge-base-documents";
import { searchKnowledgeBaseTool } from "./search-knowledge-base";

export const buildKnowledgeBaseTools = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) => ({
	searchKnowledgeBase: searchKnowledgeBaseTool({
		blocks,
	}),
	listKnowledgeBaseDocuments: listKnowledgeBaseDocumentsTool({
		blocks,
	}),
	getKnowledgeBasePage: getKnowledgeBasePageTool({
		blocks,
	}),
	getKnowledgeBaseChunks: getKnowledgeBaseChunksTool({
		blocks,
	}),
});
