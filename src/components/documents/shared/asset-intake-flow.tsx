import { useState } from "react";
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
	type UploadedFile,
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
import type { Asset } from "@/lib/orpc/schemas/asset";

type IntakeStep = "upload" | "uploaded" | "review";

const AssetIntakeFlow = ({
	onAssetsSaved,
	submitLabel = "Save Documents",
}: {
	onAssetsSaved?: (assets: Asset[]) => void;
	submitLabel?: string;
}) => {
	const [step, setStep] = useState<IntakeStep>("upload");
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [drafts, setDrafts] = useState<Record<string, AssetMetadataDraft>>({});
	const { mutate: saveManyAssets, isPending } = useSaveManyAssetsMutation({
		onSuccess: (result) => {
			onAssetsSaved?.(result.data);
			setUploadedFiles([]);
			setDrafts({});
			setStep("upload");
		},
	});

	return (
		<div className="space-y-6">
			{step !== "review" ? (
				<UploadComponent
					route="asset"
					title="Upload Documents"
					description="Select all files for this batch, upload them, then continue to add metadata for each document."
					uploadLabel="Upload Batch"
					finalizeUpload
					hidePickerWhenSettled
					completionAction={{
						label: "Next",
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
						<CardTitle>Review Uploaded Files</CardTitle>
						<CardDescription>
							Add metadata to each uploaded file before creating the final
							assets.
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
								{
									uploadedFiles.filter((file) =>
										hasMetadataAdded(
											drafts[file.id] ?? {
												title: file.name,
												metadata: createDefaultAssetMetadata(),
											},
											file.name,
										),
									).length
								}{" "}
								of {uploadedFiles.length} files have metadata added.
							</div>
							<Button
								disabled={isPending}
								onClick={() => {
									if (uploadedFiles.length === 0) {
										toast.error("Upload at least one file first.");
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
								{submitLabel}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
};

export { AssetIntakeFlow };
