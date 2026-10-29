import type { ActivityRunId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { SelectedAssetList } from "@/components/documents/shared/selected-asset-list";
import {
	UploadComponent,
	type UploadVariant,
} from "@/components/documents/upload-component";
import type { UploadFailure } from "@/components/documents/use-asset-intake";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useUtilityModel } from "@/hooks/use-utility-model";
import { ownerCapabilities } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { m } from "@/paraglide/messages";

type IntakeStep = "upload" | "review";

/**
 * Uploads files as assets, then lists the created assets for metadata edits
 * that save at once. Only an upload in flight can be lost, so only then does
 * leaving ask first; leaving anyway aborts it.
 */
const AssetIntakeFlow = ({
	onAssetsCreated,
	onAssetUpdated,
	onPendingChange,
	onDone,
	variant = "page",
}: {
	/**
	 * Also hands over the create call's zedToken, so later reads see the new
	 * assets, and the upload's activity run.
	 */
	onAssetsCreated?: (
		assets: Asset[],
		zedToken: string | undefined,
		runId: ActivityRunId | undefined,
	) => void;
	onAssetUpdated?: (asset: Asset) => void;
	/** True while files upload or their assets are being created. */
	onPendingChange?: (pending: boolean) => void;
	/** Shows Done in the review step. */
	onDone?: () => void;
	variant?: UploadVariant;
}) => {
	const [step, setStep] = useState<IntakeStep>("upload");
	const [assets, setAssets] = useState<Asset[]>([]);
	const [failures, setFailures] = useState<UploadFailure[]>([]);
	const [pending, setPending] = useState(false);

	useUnsavedChangesGuard(() => pending);

	const changePending = (value: boolean) => {
		setPending(value);
		onPendingChange?.(value);
	};

	const isCompact = variant === "compact";
	const utilityModel = useUtilityModel();
	// The uploads as they are now: prepared, and with metadata generated in the background.
	const { data: current } = useQuery(
		orpc.asset.list.queryOptions({
			input:
				assets.length > 0
					? {
							pageIndex: 0,
							pageSize: assets.length,
							filters: {
								ids: assets.map((asset) => asset.id),
							},
						}
					: skipToken,
			refetchInterval: (query) =>
				(query.state.data?.data ?? assets).some(isAssetWorking)
					? METADATA_POLL_MS
					: false,
		}),
	);
	const shown = assets.map(
		(asset) => current?.data.find((fresh) => fresh.id === asset.id) ?? asset,
	);

	const review = (
		<>
			{utilityModel.available ? (
				<p className="text-muted-foreground text-sm">
					{m.assets_intake_metadata_background_hint()}
				</p>
			) : null}
			<SelectedAssetList
				assets={shown.map((asset) => ({
					...asset,
					capabilities: ownerCapabilities("asset"),
				}))}
				metadataGenerated={utilityModel.available}
				onAssetUpdated={(updated) => {
					setAssets((current) =>
						current.map((asset) => (asset.id === updated.id ? updated : asset)),
					);
					onAssetUpdated?.(updated);
				}}
			/>

			{failures.length > 0 ? (
				<div
					role="alert"
					className="space-y-1 rounded-2xl border border-status-danger/40 px-4 py-3 text-sm"
				>
					<div className="flex items-center gap-2 font-medium">
						<AlertCircleIcon className="size-4 text-status-danger" />
						{m.assets_intake_failed_title({
							count: failures.length,
						})}
					</div>
					<ul className="space-y-0.5 text-muted-foreground">
						{failures.map((failure, index) => (
							<li key={`${failure.name}-${index}`}>
								{failure.name}: {failure.message}
							</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					onClick={() => {
						setFailures([]);
						setStep("upload");
					}}
				>
					{m.assets_intake_upload_more_button()}
				</Button>
				{onDone ? (
					<Button onClick={onDone}>{m.assets_intake_done_button()}</Button>
				) : null}
			</div>
		</>
	);

	return (
		<div className={isCompact ? "space-y-4" : "space-y-6"}>
			{step === "upload" ? (
				<UploadComponent
					variant={variant}
					title={m.assets_intake_upload_title()}
					description={m.assets_intake_upload_description()}
					uploadLabel={m.assets_intake_upload_button()}
					onPendingChange={changePending}
					onCreated={({
						assets: created,
						failures: failed,
						zedToken,
						runId,
					}) => {
						setAssets((current) => [
							...current,
							...created.filter(
								(asset) => !current.some((known) => known.id === asset.id),
							),
						]);
						setFailures(failed);
						setStep("review");
						if (created.length > 0) onAssetsCreated?.(created, zedToken, runId);
					}}
				/>
			) : isCompact ? (
				<div className="space-y-4">
					<div className="space-y-1">
						<p className="font-medium">{m.assets_intake_review_title()}</p>
						<p className="text-muted-foreground text-sm">
							{m.assets_intake_review_description()}
						</p>
					</div>
					{review}
				</div>
			) : (
				<Card className="border-border/70 bg-background shadow-sm">
					<CardHeader>
						<CardTitle>{m.assets_intake_review_title()}</CardTitle>
						<CardDescription>
							{m.assets_intake_review_description()}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">{review}</CardContent>
				</Card>
			)}
		</div>
	);
};

export { AssetIntakeFlow };
