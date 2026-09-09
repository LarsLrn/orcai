import type { ToolPart } from "@/components/chat/message/classify-turn";
import { ToolEntry } from "./tool-entry";
import { toolLabels } from "./tool-labels";
import { GetKnowledgeBaseChunks } from "./tools/get-knowledge-base-chunks";
import { GetKnowledgeBasePage } from "./tools/get-knowledge-base-page";
import { ListKnowledgeBaseDocuments } from "./tools/list-knowledge-base-documents";
import { SearchKnowledgeBase } from "./tools/search-knowledge-base";

export interface ToolEntryPartProps {
	part: ToolPart;
	running: boolean;
}

/** Routes a tool part to its renderer; anything else gets the generic entry. */
export const ToolEntryPart = ({ part, running }: ToolEntryPartProps) => {
	switch (part.type) {
		case "tool-searchKnowledgeBase":
			return <SearchKnowledgeBase part={part} running={running} />;
		case "tool-getKnowledgeBaseChunks":
			return <GetKnowledgeBaseChunks part={part} running={running} />;
		case "tool-getKnowledgeBasePage":
			return <GetKnowledgeBasePage part={part} running={running} />;
		case "tool-listKnowledgeBaseDocuments":
			return <ListKnowledgeBaseDocuments part={part} running={running} />;
		default:
			return (
				<ToolEntry
					part={part}
					running={running}
					label={toolLabels(part).name}
				/>
			);
	}
};
