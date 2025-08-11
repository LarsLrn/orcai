import type { ToolUIPart } from "ai";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import type { CustomTools } from "@/lib/ai/tools";
import { ImageGenerationTool } from "./tools/image-generation-tool";
import { SearchKnowledgeBaseTool } from "./tools/search-knowledgebase-tool";

export const ToolCallPart = ({ part }: { part: ToolUIPart<CustomTools> }) => {
	// Route to specific tool components based on tool type
	if (part.type === "tool-generateImage") {
		return <ImageGenerationTool part={part} />;
	}

	if (part.type === "tool-searchKnowledgeBase") {
		return <SearchKnowledgeBaseTool part={part} />;
	}

	// Fallback for unknown tool types
	return (
		<Tool defaultOpen={true}>
			<ToolHeader type="unknown" state={part.state} />
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={JSON.stringify(part.output)}
					errorText={part.errorText}
				/>
			</ToolContent>
		</Tool>
	);
};
