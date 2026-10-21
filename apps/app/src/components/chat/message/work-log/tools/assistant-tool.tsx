import {
	type SummarisedToolPart,
	useToolSummaryLine,
} from "@/components/assistant/tool-summaries";
import { uploadedAssets } from "@/lib/ai/tools/assistant/bots/request-upload.summary";
import type { AssistantToolPart } from "@/lib/ai/tools/assistant/summary";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { ToolEntry } from "../tool-entry";

export const AssistantTool = ({
	part,
	status,
}: {
	part: SummarisedToolPart;
	status: ToolStatus | null;
}) => {
	const line = useToolSummaryLine(part);

	return <ToolEntry part={part} status={status} label={line} />;
};

/** Lists the saved assets under the summary line. */
export const RequestUpload = ({
	part,
	status,
}: {
	part: AssistantToolPart<"requestUpload">;
	status: ToolStatus | null;
}) => {
	const line = useToolSummaryLine(part);
	const assets = part.state === "input-streaming" ? [] : uploadedAssets(part);

	return (
		<ToolEntry part={part} status={status} label={line}>
			{assets.length > 0 ? (
				<ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
					{assets.map((asset) => (
						<li key={asset.id} className="truncate">
							{asset.title}
						</li>
					))}
				</ul>
			) : undefined}
		</ToolEntry>
	);
};
