import { ToolLoadingState } from "@/components/chat/message/parts/tool-loading-state";
import type { GenerateImageToolPart } from "@/lib/ai/tools";

export const ImageGenerationTool = ({
	part,
}: {
	part: GenerateImageToolPart;
}) => {
	// Handle loading states
	if (part.state === "input-available" || part.state === "input-streaming") {
		return (
			<ToolLoadingState
				toolName="Generating Image"
				description="Please wait while we create your image..."
			/>
		);
	}

	// Handle completed state
	if (part.state === "output-available" && part.output) {
		return (
			<div className="rounded-lg border bg-muted/20 p-4">
				<p className="mb-2 font-medium text-foreground text-sm">
					Image Generated Successfully
				</p>
				<p className="text-muted-foreground text-xs">
					{part.output.description}
				</p>
			</div>
		);
	}

	// Handle error state
	if (part.state === "output-error") {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
				<p className="font-medium text-destructive text-sm">
					Image Generation Failed
				</p>
				<p className="text-destructive/80 text-xs">
					There was an error generating the image. Please try again.
					{part.errorText}
				</p>
			</div>
		);
	}

	return null;
};
