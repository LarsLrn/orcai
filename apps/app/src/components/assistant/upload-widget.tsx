import { MAX_KEPT_UPLOADS } from "@orcai/schema";
import { useId } from "react";
import { AssetIntakeFlow } from "@/components/assets/shared/asset-intake-flow";
import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import { useUploadAnswer } from "@/components/assistant/use-upload-answer";
import { toolStatusLabel } from "@/components/chat/message/work-log/tool-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { useDeleteAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import { useConfirmDiscard } from "@/hooks/use-unsaved-changes-guard";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import { toolLabels } from "@/lib/ai/tools/registry";
import type { ToolPartOf, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";

/**
 * `requestUpload` waiting for the user: the reason and the intake flow, where
 * Remove deletes an upload, Continue answers with the files listed and Cancel
 * answers without them.
 */
export const UploadWidget = ({
	part,
	status,
	answers,
}: {
	part: ToolPartOf<"requestUpload">;
	status: ToolStatus | null;
	/** Left out unless the call can be answered. */
	answers: StepAnswers | undefined;
}) => {
	const titleId = useId();
	const line = useToolSummaryLine(part);
	const Icon = toolLabels(part).icon;
	const awaiting = part.state === "input-available" ? part : undefined;
	const upload = useUploadAnswer({
		toolCallId: part.toolCallId,
		answers,
		confirmDiscard: useConfirmDiscard(),
	});
	const { mutateAsync: deleteAssets } = useDeleteAssetsMutation();

	return (
		<Item
			variant="outline"
			size="sm"
			className="not-prose"
			role="group"
			aria-labelledby={titleId}
		>
			<ItemMedia variant="icon">
				<Icon />
			</ItemMedia>
			<ItemContent>
				<ItemTitle id={titleId} className="line-clamp-none">
					{line}
				</ItemTitle>
			</ItemContent>
			{status && (
				<ItemActions>
					<Badge variant="outline">{toolStatusLabel(status)}</Badge>
				</ItemActions>
			)}
			{awaiting && answers && (
				<div className="flex min-w-0 basis-full flex-col gap-3">
					<p className="text-muted-foreground">{awaiting.input.reason}</p>
					<AssetIntakeFlow
						variant="compact"
						initialAssetIds={upload.initialAssetIds}
						onPendingChange={upload.setIsUploading}
						onAssetsCreated={upload.created}
						onRemove={async (asset) => {
							const deleted = await deleteAssets({
								refs: [
									{
										id: asset.id,
									},
								],
							});
							if (deleted.status !== "success") return false;
							upload.removed(asset.id);
							return true;
						}}
						onDone={() => void upload.continue()}
						doneLabel={m.assistant_tool_request_upload_continue_button()}
						onCancel={() => void upload.cancel()}
						maxAssets={MAX_KEPT_UPLOADS}
					/>
					{upload.problem && (
						<div
							role="alert"
							className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-status-danger/40 px-4 py-3 text-sm"
						>
							<span>
								{upload.problem === "unsaved"
									? m.assistant_tool_request_upload_unsaved()
									: m.assistant_tool_request_upload_gone()}
							</span>
							{upload.problem === "unsaved" && (
								<Button variant="outline" size="sm" onClick={upload.retry}>
									{m.assistant_tool_request_upload_retry_button()}
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</Item>
	);
};
