import { Response } from "@/components/ai-elements/response";
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
		<Tool defaultOpen={true}>
			<ToolHeader type="tool-generateImage" state={part.state} />
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={<Response>{JSON.stringify(part.output)}</Response>}
					errorText={part.errorText}
				/>
			</ToolContent>
		</Tool>
	);
};
