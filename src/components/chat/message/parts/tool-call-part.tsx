import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { GetKnowledgeBaseChunks } from "./tools/get-knowledge-base-chunks";
import { GetKnowledgeBasePage } from "./tools/get-knowledge-base-page";
import { ListKnowledgeBaseDocuments } from "./tools/list-knowledge-base-documents";
import { SearchKnowledgeBase } from "./tools/search-knowledge-base";

export const ToolCallPart = ({
	part,
}: {
	part: ChatAgentUIMessage["parts"][number];
}) => {
	// Route to specific tool components based on tool type
	/* if (part.type === "tool-generateImage") {
		return <ImageGenerationTool part={part} />;
	} */

	if (part.type === "tool-searchKnowledgeBase") {
		return <SearchKnowledgeBase part={part} />;
	}

	if (part.type === "tool-getKnowledgeBaseChunks") {
		return <GetKnowledgeBaseChunks part={part} />;
	}

	if (part.type === "tool-getKnowledgeBasePage") {
		return <GetKnowledgeBasePage part={part} />;
	}

	if (part.type === "tool-listKnowledgeBaseDocuments") {
		return <ListKnowledgeBaseDocuments part={part} />;
	}

	// Fallback for unknown tool types
	if (part.type === "dynamic-tool") {
		return (
			<Tool defaultOpen={false}>
				<ToolHeader
					toolName={part.toolName}
					type={part.type}
					state={part.state}
				/>
				<ToolContent>
					<ToolInput input={part.input} />
					<ToolOutput
						output={JSON.stringify(part.output)}
						errorText={part.errorText}
					/>
				</ToolContent>
			</Tool>
		);
	}

	// Don't render unknown parts
	return null;
};
