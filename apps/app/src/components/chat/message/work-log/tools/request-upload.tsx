import type { AssetId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import { AssetMetadataDialog } from "@/components/documents/shared/asset-metadata-dialog";
import { Button } from "@/components/ui/button";
import { uploadedAssets } from "@/lib/ai/tools/assistant/bots/request-upload.declaration";
import type { ClientToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { ToolEntry } from "../tool-entry";

/** Loads the asset when opened, so a reloaded conversation can still edit it. */
const EditMetadataAction = ({
	assetId,
	title,
}: {
	assetId: AssetId;
	title: string;
}) => {
	const [open, setOpen] = useState(false);
	const { data } = useQuery({
		...orpc.asset.find.queryOptions({
			input: {
				id: assetId,
			},
		}),
		enabled: open,
	});

	return (
		<>
			<Button
				variant="ghost"
				size="xs"
				aria-label={m.assistant_tool_request_upload_edit_metadata_label({
					title,
				})}
				onClick={() => setOpen(true)}
			>
				<PencilIcon />
				{m.assets_selected_list_metadata_button()}
			</Button>
			<AssetMetadataDialog
				asset={data?.data}
				open={open}
				onOpenChange={setOpen}
			/>
		</>
	);
};

/** Lists the saved assets under the summary line, each with its metadata. */
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
						<li key={asset.id} className="flex items-center gap-2">
							<span className="min-w-0 truncate">{asset.title}</span>
							<EditMetadataAction assetId={asset.id} title={asset.title} />
						</li>
					))}
				</ul>
			) : undefined}
		</ToolEntry>
	);
};
