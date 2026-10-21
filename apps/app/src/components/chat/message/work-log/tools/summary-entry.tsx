import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import type { ToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { ToolEntry } from "../tool-entry";

/** A call read through its declaration's summary line, or named by it. */
export const SummaryEntry = ({
	part,
	status,
}: {
	part: ToolPart;
	status: ToolStatus | null;
}) => {
	const line = useToolSummaryLine(part);

	return <ToolEntry part={part} status={status} label={line} />;
};
