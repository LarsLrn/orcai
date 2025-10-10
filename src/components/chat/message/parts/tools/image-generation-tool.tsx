import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import type { GenerateImageToolPart } from "@/lib/ai/tools";

export const ImageGenerationTool = ({
	part,
}: {
	part: GenerateImageToolPart;
}) => {
	return (
		<Tool defaultOpen={part.state !== "output-available"}>
			<ToolHeader type="tool-generateImage" state={part.state} />
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={Output({ output: part.output })}
					errorText={part.errorText}
				/>
			</ToolContent>
		</Tool>
	);
};

const Output = ({ output }: { output: GenerateImageToolPart["output"] }) => {
	if (!output) {
		return null;
	}

	return (
		<div className="space-y-3 p-4">
			{output.description && (
				<div className="space-y-1">
					<h4 className="font-medium text-sm">Description</h4>
					<p className="rounded-md text-muted-foreground text-sm">
						{output.description}
					</p>
				</div>
			)}
		</div>
	);
};
