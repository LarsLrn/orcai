import { useId } from "react";
import { useToolSummaryLine } from "@/components/assistant/tool-summary-line";
import { useUploadAnswer } from "@/components/assistant/use-upload-answer";
import { toolStatusLabel } from "@/components/chat/message/work-log/tool-status";
import { AssetIntakeFlow } from "@/components/documents/shared/asset-intake-flow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { useConfirmDiscard } from "@/hooks/use-unsaved-changes-guard";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import { toolLabels } from "@/lib/ai/tools/registry";
import type { ToolPartOf, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";

/** `requestUpload` waiting for the user: the reason, the intake flow and Cancel. Created assets answer it. */
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
						onPendingChange={upload.setIsUploading}
						onAssetsCreated={upload.created}
					/>
					<div className="flex justify-end">
						<Button
							variant="outline"
							size="sm"
							onClick={() => void upload.cancel()}
						>
							{m.common_cancel_button()}
						</Button>
					</div>
				</div>
			)}
		</Item>
	);
};
