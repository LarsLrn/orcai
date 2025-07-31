import { ToolLoadingState } from "../tool-loading-state";

interface ImageGenerationToolProps {
	part: any; // Using any for now since the tool part types are complex
}

export const ImageGenerationTool = ({ part }: ImageGenerationToolProps) => {
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
	if (part.state === "complete" && part.result) {
		return (
			<div className="rounded-lg border bg-muted/20 p-4">
				<p className="mb-2 font-medium text-foreground text-sm">
					Image Generated Successfully
				</p>
				<p className="text-muted-foreground text-xs">{part.result}</p>
			</div>
		);
	}

	// Handle error state
	if (part.state === "error") {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
				<p className="font-medium text-destructive text-sm">
					Image Generation Failed
				</p>
				<p className="text-destructive/80 text-xs">
					There was an error generating the image. Please try again.
				</p>
			</div>
		);
	}

	return null;
};
