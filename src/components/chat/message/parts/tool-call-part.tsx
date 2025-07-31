import { ImageGenerationTool } from "./tools/image-generation-tool";

interface ToolCallPartProps {
	part: any; // Using any for now since tool part types are complex
}

export const ToolCallPart = ({ part }: ToolCallPartProps) => {
	// Route to specific tool components based on tool type
	if (part.type === "tool-generateImage") {
		return <ImageGenerationTool part={part} />;
	}

	// Add more tool types here as needed
	// if (part.type === "tool-codeExecution") {
	//   return <CodeExecutionTool part={part} />;
	// }

	// Fallback for unknown tool types
	return (
		<div className="rounded-lg border border-dashed bg-muted/50 p-4">
			<p className="text-muted-foreground text-sm">Unknown tool: {part.type}</p>
		</div>
	);
};
