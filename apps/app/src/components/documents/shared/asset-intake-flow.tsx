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
import { UploadComponent } from "@/components/documents/upload-component";
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
	submitLabel,
}: {
	onAssetsSaved?: (assets: Asset[]) => void;
	onPendingChange?: (pending: boolean) => void;
	submitLabel?: string;
}) => {
	const [step, setStep] = useState<IntakeStep>("upload");
	const [uploadedFiles, setUploadedFiles] = useState<FinalizedUploadFile[]>([]);
	const [drafts, setDrafts] = useState<Record<string, AssetMetadataDraft>>({});
	const { mutate: saveManyAssets, isPending } = useSaveManyAssetsMutation({
		onSuccess: (result) => {
			onAssetsSaved?.(result.data);
			setUploadedFiles([]);
			setDrafts({});
			setStep("upload");
		},
	});

	const hasPending = uploadedFiles.length > 0;

	useUnsavedChangesGuard(() => hasPending);

	useEffect(() => {
		onPendingChange?.(hasPending);
	}, [
		hasPending,
		onPendingChange,
	]);

	return (
		<div className="space-y-6">
			{step !== "review" ? (
				<UploadComponent
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
				<Card className="border-border/70 bg-background shadow-sm">
					<CardHeader>
						<CardTitle>{m.assets_intake_review_title()}</CardTitle>
						<CardDescription>
							{m.assets_intake_review_description()}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
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
												drafts[file.id]?.metadata ??
												createDefaultAssetMetadata(),
											upload: file,
										})),
									});
								}}
							>
								{submitLabel ?? m.assets_intake_submit_button()}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
};

export { AssetIntakeFlow };
