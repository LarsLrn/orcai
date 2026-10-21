import { clientToolRenderersOf } from "@/components/assistant/client-tool-renderers";
import { isToolOfKind } from "@/lib/ai/tools/registry";
import type { ToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { GetKnowledgeBaseChunks } from "./tools/get-knowledge-base-chunks";
import { GetKnowledgeBasePage } from "./tools/get-knowledge-base-page";
import { ListKnowledgeBaseDocuments } from "./tools/list-knowledge-base-documents";
import { ReadDocs } from "./tools/read-docs";
import { SearchKnowledgeBase } from "./tools/search-knowledge-base";
import { SummaryEntry } from "./tools/summary-entry";

export interface ToolEntryPartProps {
	part: ToolPart;
	status: ToolStatus | null;
}

/** Routes a tool part to its renderer; any other reads as its summary line. */
export const ToolEntryPart = ({ part, status }: ToolEntryPartProps) => {
	if (isToolOfKind(part, "client")) {
		const { Entry } = clientToolRenderersOf(part);
		return <Entry part={part} status={status} />;
	}

	switch (part.type) {
		case "tool-searchKnowledgeBase":
			return <SearchKnowledgeBase part={part} status={status} />;
		case "tool-getKnowledgeBaseChunks":
			return <GetKnowledgeBaseChunks part={part} status={status} />;
		case "tool-getKnowledgeBasePage":
			return <GetKnowledgeBasePage part={part} status={status} />;
		case "tool-listKnowledgeBaseDocuments":
			return <ListKnowledgeBaseDocuments part={part} status={status} />;
		case "tool-readDocs":
			return <ReadDocs part={part} status={status} />;
		default:
			return <SummaryEntry part={part} status={status} />;
	}
};
