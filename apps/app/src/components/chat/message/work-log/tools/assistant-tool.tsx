import {
	type SummarisedToolPart,
	useToolSummaryLine,
} from "@/components/assistant/tool-summaries";
import { ToolEntry } from "../tool-entry";

export const AssistantTool = ({
	part,
	running,
}: {
	part: SummarisedToolPart;
	running: boolean;
}) => {
	const line = useToolSummaryLine(part);

	return <ToolEntry part={part} running={running} label={line} />;
};
