import { listOutputSchema } from "@/lib/ai/tools/rag/outputs";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { ListRepositoryAssetsToolPart } from "@/lib/ai/types/tools";
import { formatAssetTitle } from "@/lib/presentation/asset-title";
import { m } from "@/paraglide/messages";
import { SourcePassageList } from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const ListRepositoryAssets = ({
	part,
	status,
}: {
	part: ListRepositoryAssetsToolPart;
	status: ToolStatus | null;
}) => {
	const assets = listOutputSchema.safeParse(part.output).data?.assets ?? [];

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				assets.length > 0
					? m.chat_work_log_tool_list_repository_assets_result({
							count: assets.length,
						})
					: m.chat_work_log_tool_list_repository_assets_name()
			}
		>
			{assets.length > 0 && (
				<SourcePassageList>
					{assets.map((asset) => (
						<div
							key={asset.assetId}
							className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-xs"
						>
							<span className="min-w-0 flex-1 truncate font-medium text-sm">
								{formatAssetTitle(asset.title) ??
									m.chat_source_fallback_title()}
							</span>
						</div>
					))}
				</SourcePassageList>
			)}
		</ToolEntry>
	);
};
