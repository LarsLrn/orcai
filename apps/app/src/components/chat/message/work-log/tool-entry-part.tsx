import { clientToolRenderersOf } from "@/components/assistant/client-tool-renderers";
import { isSummarisedToolPart } from "@/components/assistant/tool-summaries";
import {
	isClientToolCall,
	type ToolPart,
	type ToolStatus,
} from "@/lib/ai/turn-view/turn-view";
import { ToolEntry } from "./tool-entry";
import { toolLabels } from "./tool-labels";
import { AssistantTool } from "./tools/assistant-tool";
import { GetKnowledgeBaseChunks } from "./tools/get-knowledge-base-chunks";
import { GetKnowledgeBasePage } from "./tools/get-knowledge-base-page";
import { ListKnowledgeBaseDocuments } from "./tools/list-knowledge-base-documents";
import { ReadDocs } from "./tools/read-docs";
import { SearchKnowledgeBase } from "./tools/search-knowledge-base";

export interface ToolEntryPartProps {
	part: ToolPart;
	status: ToolStatus | null;
}

/** Routes a tool part to its renderer; anything else gets the generic entry. */
export const ToolEntryPart = ({ part, status }: ToolEntryPartProps) => {
	if (isClientToolCall(part)) {
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
			return isSummarisedToolPart(part) ? (
				<AssistantTool part={part} status={status} />
			) : (
				<ToolEntry part={part} status={status} label={toolLabels(part).name} />
			);
	}
};
