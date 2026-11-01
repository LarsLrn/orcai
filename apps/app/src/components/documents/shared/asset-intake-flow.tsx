import type { ActivityRunId, AssetId } from "@orcai/core";
import type { Asset, AssetWithCapabilities } from "@orcai/schema";
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
	initialAssetIds = [],
	onAssetsCreated,
	onAssetUpdated,
	onRemove,
	onPendingChange,
	onDone,
	doneLabel = m.assets_intake_done_button(),
	onCancel,
	maxAssets,
	variant = "page",
}: {
	/** Uploads listed from the start, as when a reload restores them. */
	initialAssetIds?: AssetId[];
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
	/** Shows Remove on each upload; resolves whether it was removed. */
	onRemove?: (asset: Asset) => Promise<boolean>;
	/** True while files upload or their assets are being created. */
	onPendingChange?: (pending: boolean) => void;
	/** Shows Done once something is uploaded. */
	onDone?: () => void;
	doneLabel?: string;
	onCancel?: () => void;
	/** How many uploads the list holds at most. */
	maxAssets?: number;
	variant?: UploadVariant;
}) => {
	const [step, setStep] = useState<IntakeStep>(
		initialAssetIds.length > 0 ? "review" : "upload",
	);
	const [assetIds, setAssetIds] = useState<AssetId[]>(initialAssetIds);
	// What create and edit returned, shown until the list query has the asset.
	const [known, setKnown] = useState<Asset[]>([]);
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
				assetIds.length > 0
					? {
							pageIndex: 0,
							pageSize: assetIds.length,
							filters: {
								ids: assetIds,
							},
						}
					: skipToken,
			refetchInterval: (query) =>
				(query.state.data?.data ?? known).some(isAssetWorking)
					? METADATA_POLL_MS
					: false,
		}),
	);
	const shown = assetIds.flatMap((id): AssetWithCapabilities[] => {
		const fresh = current?.data.find((asset) => asset.id === id);
		if (fresh)
			return [
				fresh,
			];
		// A new upload is the user's own until the list query has it.
		const created = known.find((asset) => asset.id === id);
		return created
			? [
					{
						...created,
						capabilities: ownerCapabilities("asset"),
					},
				]
			: [];
	});

	const remove = async (asset: Asset) => {
		if (!(await onRemove?.(asset))) return;
		setAssetIds((current) => current.filter((id) => id !== asset.id));
	};
	// With every upload removed there is nothing to review.
	const uploading =
		step === "upload" || (assetIds.length === 0 && failures.length === 0);

	const cancelButton = onCancel ? (
		<Button variant="outline" onClick={onCancel}>
			{m.common_cancel_button()}
		</Button>
	) : null;
	const remaining =
		maxAssets === undefined ? undefined : maxAssets - assetIds.length;
	const doneButton =
		onDone && assetIds.length > 0 ? (
			<Button disabled={pending} onClick={onDone}>
				{doneLabel}
			</Button>
		) : null;

	const review = (
		<>
			{utilityModel.available ? (
				<p className="text-muted-foreground text-sm">
					{m.assets_intake_metadata_background_hint()}
				</p>
			) : null}
			<SelectedAssetList
				assets={shown}
				metadataGenerated={utilityModel.available}
				onRemove={
					onRemove
						? (assetId) => {
								const asset = shown.find(({ id }) => id === assetId);
								if (asset) void remove(asset);
							}
						: undefined
				}
				onAssetUpdated={(updated) => {
					setKnown((current) => [
						...current.filter((asset) => asset.id !== updated.id),
						updated,
					]);
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

			{remaining !== undefined && remaining <= 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.assets_intake_limit_reached({
						count: maxAssets ?? 0,
					})}
				</p>
			) : null}

			<div className="flex flex-wrap justify-end gap-2">
				{cancelButton}
				<Button
					variant="outline"
					disabled={remaining !== undefined && remaining <= 0}
					onClick={() => {
						setFailures([]);
						setStep("upload");
					}}
				>
					{m.assets_intake_upload_more_button()}
				</Button>
				{doneButton}
			</div>
		</>
	);

	return (
		<div className={isCompact ? "space-y-4" : "space-y-6"}>
			{uploading ? (
				<>
					<UploadComponent
						variant={variant}
						maxFileCount={remaining}
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
							setKnown((current) => [
								...current,
								...created,
							]);
							setAssetIds((current) => [
								...current,
								...created
									.map((asset) => asset.id)
									.filter((id) => !current.includes(id)),
							]);
							setFailures(failed);
							setStep("review");
							if (created.length > 0)
								onAssetsCreated?.(created, zedToken, runId);
						}}
					/>
					{cancelButton || doneButton ? (
						<div className="flex flex-wrap justify-end gap-2">
							{cancelButton}
							{doneButton}
						</div>
					) : null}
				</>
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
