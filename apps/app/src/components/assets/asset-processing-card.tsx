import type { Asset } from "@orcai/schema";
import { RotateCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InfoDot } from "@/components/ui/composed/info-dot";
import { usePrepareAssetAgainMutation } from "@/hooks/mutations/use-asset-mutations";
import {
	canPrepareAgain,
	getPipelineFailureDescription,
} from "@/lib/presentation/asset-state";
import {
	getProcessingStatusDescription,
	processingStatusBadge,
} from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** How far processing of the file is, why it failed, and Retry when that can help. */
const AssetProcessingCard = ({
	asset,
	canEdit,
	className,
}: {
	asset: Pick<
		Asset,
		"id" | "fileType" | "processingStatus" | "processingFailure"
	>;
	canEdit: boolean;
	className?: string;
}) => {
	const { mutate: prepareAssetAgain, isPending: preparingAgain } =
		usePrepareAssetAgainMutation();
	const {
		label,
		variant,
		icon: Icon,
		className: badgeClassName,
	} = processingStatusBadge(asset.processingStatus);
	const failure =
		asset.processingStatus === "failed" ? asset.processingFailure : null;

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-1">
					{m.assets_processing_card_title()}
					<InfoDot content={m.assets_processing_card_info_description()} />
				</CardTitle>
				<CardDescription>
					{failure
						? getPipelineFailureDescription(failure, asset.fileType)
						: getProcessingStatusDescription(asset.processingStatus)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-2">
				<Badge variant={variant} className={badgeClassName}>
					{Icon ? <Icon /> : null}
					{label}
				</Badge>
				{canEdit &&
					asset.processingStatus === "failed" &&
					canPrepareAgain(failure ?? "other", asset.fileType) && (
						<Button
							variant="outline"
							size="sm"
							disabled={preparingAgain}
							onClick={() =>
								prepareAssetAgain({
									id: asset.id,
								})
							}
						>
							<RotateCwIcon />
							{m.assets_processing_card_retry_button()}
						</Button>
					)}
			</CardContent>
		</Card>
	);
};

export { AssetProcessingCard };
