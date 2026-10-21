import type { DatabaseBlock } from "@orcai/schema";
import type { UIMessage } from "ai";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { chunkIds } from "./chunk-ref";
import { getKnowledgeBaseChunksTool } from "./get-knowledge-base-chunk";
import { getKnowledgeBasePageTool } from "./get-knowledge-base-page";
import { listKnowledgeBaseDocumentsTool } from "./list-knowledge-base-documents";
import { passagesOfParts } from "./outputs";
import { searchKnowledgeBaseTool } from "./search-knowledge-base";

/** The knowledge base tools of a turn, which reads chunk refs from `history` on. */
export const buildKnowledgeBaseTools = ({
	blocks,
	context,
	history,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
	history: readonly UIMessage[];
}) => {
	const deps = {
		blocks,
		context,
		chunks: chunkIds(history.flatMap(({ parts }) => passagesOfParts(parts))),
	};

	return {
		searchKnowledgeBase: searchKnowledgeBaseTool(deps),
		listKnowledgeBaseDocuments: listKnowledgeBaseDocumentsTool(deps),
		getKnowledgeBasePage: getKnowledgeBasePageTool(deps),
		getKnowledgeBaseChunks: getKnowledgeBaseChunksTool(deps),
	};
};
