import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import { uploadedAssets } from "@/lib/ai/tools/assistant/bots/request-upload.declaration";
import type { ClientToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { ToolEntry } from "../tool-entry";

/** Lists the saved assets under the summary line. */
export const RequestUpload = ({
	part,
	status,
}: {
	part: ClientToolPart;
	status: ToolStatus | null;
}) => {
	const line = useToolSummaryLine(part);
	const assets = uploadedAssets(
		part.state === "output-available" ? part.output : undefined,
	);

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
