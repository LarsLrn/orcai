import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { SearchKnowledgeBaseTool } from "./tools/search-knowledgebase-tool";

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
		return <SearchKnowledgeBaseTool part={part} />;
	}

	// Fallback for unknown tool types
	if (part.type === "dynamic-tool") {
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
		</Tool>;
	}

	// Don't render unknown parts
	return null;
};
