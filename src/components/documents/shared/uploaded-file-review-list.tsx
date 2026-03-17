import { CheckCircle2Icon, PencilIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
	type AssetMetadataDraft,
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
import type { UploadedFile } from "@/components/documents/upload-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const hasMetadataAdded = (draft: AssetMetadataDraft, fileName: string) => {
	const defaults = createDefaultAssetMetadata();
	const metadata = draft.metadata ?? defaults;

	return (
		draft.title.trim() !== fileName ||
		(metadata.author ?? "") !== (defaults.author ?? "") ||
		(metadata.citation ?? "") !== (defaults.citation ?? "") ||
		(metadata.chapterTitle ?? "") !== (defaults.chapterTitle ?? "") ||
		(metadata.pageRange ?? "") !== (defaults.pageRange ?? "") ||
		(metadata.externalUrl ?? "") !== (defaults.externalUrl ?? "") ||
		(metadata.relevance ?? defaults.relevance) !== defaults.relevance ||
		(metadata.showReference ?? defaults.showReference) !==
			defaults.showReference
	);
};

const UploadedFileReviewList = ({
	files,
	drafts,
	onDraftChange,
}: {
	files: UploadedFile[];
	drafts: Record<string, AssetMetadataDraft>;
	onDraftChange: (fileId: string, draft: AssetMetadataDraft) => void;
}) => {
	const [editingFileId, setEditingFileId] = useState<string | null>(null);

	const filesWithStatus = useMemo(
		() =>
			files.map((file) => {
				const draft = drafts[file.id] ?? {
					title: file.name,
					metadata: createDefaultAssetMetadata(),
				};

				return {
					file,
					draft,
					hasMetadata: hasMetadataAdded(draft, file.name),
				};
			}),
		[
			drafts,
			files,
		],
	);

	return (
		<div className="space-y-3">
			{filesWithStatus.map(({ file, draft, hasMetadata }) => (
				<div
					key={file.id}
					className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-background px-4 py-3 shadow-xs"
				>
					<div className="min-w-0 flex-1">
						<div className="truncate font-medium text-sm">{draft.title}</div>
						<div className="mt-1 flex flex-wrap gap-2 text-xs">
							<Badge variant="secondary">{file.type || "file"}</Badge>
							<Badge variant={hasMetadata ? "default" : "outline"}>
								{hasMetadata ? "Metadata added" : "Needs metadata"}
							</Badge>
						</div>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => setEditingFileId(file.id)}
					>
						{hasMetadata ? <CheckCircle2Icon /> : <PencilIcon />}
						{hasMetadata ? "Edit Metadata" : "Add Metadata"}
					</Button>

					<Dialog
						open={editingFileId === file.id}
						onOpenChange={(open) => setEditingFileId(open ? file.id : null)}
					>
						<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-3xl">
							<DialogHeader>
								<DialogTitle>Source Metadata</DialogTitle>
								<DialogDescription>
									Define how this uploaded file should appear in AI citations
									and references.
								</DialogDescription>
							</DialogHeader>

							<AssetMetadataEditor
								value={draft}
								onChange={(nextValue) => onDraftChange(file.id, nextValue)}
							/>

							<DialogFooter>
								<Button onClick={() => setEditingFileId(null)}>
									Save Metadata
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			))}
		</div>
	);
};

export { hasMetadataAdded, UploadedFileReviewList };
