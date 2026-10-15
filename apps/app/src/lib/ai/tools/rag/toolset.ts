import type { DatabaseBlock } from "@orcai/schema";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { getKnowledgeBaseChunksTool } from "./get-knowledge-base-chunk";
import { getKnowledgeBasePageTool } from "./get-knowledge-base-page";
import { listKnowledgeBaseDocumentsTool } from "./list-knowledge-base-documents";
import { searchKnowledgeBaseTool } from "./search-knowledge-base";

export const buildKnowledgeBaseTools = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) => ({
	searchKnowledgeBase: searchKnowledgeBaseTool({
		blocks,
		context,
	}),
	listKnowledgeBaseDocuments: listKnowledgeBaseDocumentsTool({
		blocks,
		context,
	}),
	getKnowledgeBasePage: getKnowledgeBasePageTool({
		blocks,
		context,
	}),
	getKnowledgeBaseChunks: getKnowledgeBaseChunksTool({
		blocks,
		context,
	}),
});
