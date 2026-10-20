import type { Asset, FinalizedUploadFile } from "@orcai/schema";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	type AssetMetadataDraft,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
import {
	hasMetadataAdded,
	UploadedFileReviewList,
} from "@/components/documents/shared/uploaded-file-review-list";
import {
	UploadComponent,
	type UploadVariant,
} from "@/components/documents/upload-component";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSaveManyAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { m } from "@/paraglide/messages";

type IntakeStep = "upload" | "uploaded" | "review";

const AssetIntakeFlow = ({
	onAssetsSaved,
	onPendingChange,
	onSavingChange,
	submitLabel,
	variant = "page",
}: {
	/** Also hands over the save's zedToken, so later reads see the new assets. */
	onAssetsSaved?: (assets: Asset[], zedToken: string | undefined) => void;
	onPendingChange?: (pending: boolean) => void;
	/** Whether `asset.saveMany` is running. */
	onSavingChange?: (saving: boolean) => void;
	submitLabel?: string;
	variant?: UploadVariant;
}) => {
	const [step, setStep] = useState<IntakeStep>("upload");
	const [uploadedFiles, setUploadedFiles] = useState<FinalizedUploadFile[]>([]);
	const [drafts, setDrafts] = useState<Record<string, AssetMetadataDraft>>({});
	const { mutate: saveManyAssets, isPending } = useSaveManyAssetsMutation({
		onSuccess: (result) => {
			onAssetsSaved?.(result.data, result.meta?.zedToken);
			setUploadedFiles([]);
			setDrafts({});
			setStep("upload");
		},
	});

	const hasPending = uploadedFiles.length > 0;

	useUnsavedChangesGuard(() => hasPending);

	useEffect(() => {
		onSavingChange?.(isPending);
	}, [
		isPending,
		onSavingChange,
	]);

	useEffect(() => {
		onPendingChange?.(hasPending);
	}, [
		hasPending,
		onPendingChange,
	]);

	const isCompact = variant === "compact";

	const review = (
		<>
			<UploadedFileReviewList
				files={uploadedFiles}
				drafts={drafts}
				onDraftChange={(fileId, nextDraft) =>
					setDrafts((current) => ({
						...current,
						[fileId]: nextDraft,
					}))
				}
			/>

			<div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/15 px-4 py-3">
				<div className="text-muted-foreground text-sm">
					{m.assets_intake_review_metadata_count({
						completed: uploadedFiles.filter((file) =>
							hasMetadataAdded(
								drafts[file.id] ?? {
									title: file.name,
									metadata: createDefaultAssetMetadata(),
								},
								file.name,
							),
						).length,
						count: uploadedFiles.length,
					})}
				</div>
				<Button
					loading={isPending}
					onClick={() => {
						if (uploadedFiles.length === 0) {
							toast.error(m.assets_intake_no_files_toast_error());
							return;
						}

						saveManyAssets({
							assets: uploadedFiles.map((file) => ({
								title: drafts[file.id]?.title ?? file.name,
								metadata:
									drafts[file.id]?.metadata ?? createDefaultAssetMetadata(),
								upload: file,
							})),
						});
					}}
				>
					{submitLabel ?? m.assets_intake_submit_button()}
				</Button>
			</div>
		</>
	);

	return (
		<div className={isCompact ? "space-y-4" : "space-y-6"}>
			{step !== "review" ? (
				<UploadComponent
					variant={variant}
					route="asset"
					title={m.assets_intake_upload_title()}
					description={m.assets_intake_upload_description()}
					uploadLabel={m.assets_intake_upload_button()}
					finalizeUpload
					hidePickerWhenSettled
					completionAction={{
						label: m.common_next_button(),
						onClick: () => setStep("review"),
						disabled: uploadedFiles.length === 0,
					}}
					onReset={() => {
						setUploadedFiles([]);
						setDrafts({});
						setStep("upload");
					}}
					onUploaded={({ finalizedFiles }) => {
						setUploadedFiles((current) => [
							...current,
							...finalizedFiles.filter(
								(file) =>
									!current.some((existingFile) => existingFile.id === file.id),
							),
						]);
						setDrafts((current) => ({
							...current,
							...Object.fromEntries(
								finalizedFiles
									.filter((file) => !(file.id in current))
									.map((file) => [
										file.id,
										{
											title: file.name,
											metadata: createDefaultAssetMetadata(),
										},
									]),
							),
						}));
						setStep("uploaded");
					}}
				/>
			) : null}

			{step === "review" && uploadedFiles.length > 0 ? (
				isCompact ? (
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
				)
			) : null}
		</div>
	);
};

export { AssetIntakeFlow };
