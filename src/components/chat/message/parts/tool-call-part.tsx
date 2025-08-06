import type { ToolUIPart } from "ai";
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
		<div className="rounded-lg border border-dashed bg-muted/50 p-4">
			<p className="text-muted-foreground text-sm">Unknown tool: {part.type}</p>
		</div>
	);
};
