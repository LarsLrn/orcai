import { type Asset, isRetryableFailure } from "@orcai/schema";
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
import { useReprocessAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import { getPipelineFailureDescription } from "@/lib/presentation/document-state";
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
	asset: Pick<Asset, "id" | "processingStatus" | "processingFailure">;
	canEdit: boolean;
	className?: string;
}) => {
	const { mutate: reprocessAsset, isPending: reprocessing } =
		useReprocessAssetMutation();
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
						? getPipelineFailureDescription(failure)
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
					isRetryableFailure(failure ?? "other") && (
						<Button
							variant="outline"
							size="sm"
							disabled={reprocessing}
							onClick={() =>
								reprocessAsset({
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
