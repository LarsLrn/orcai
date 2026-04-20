import type { AssetId } from "@orcai/core";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUploadFiles } from "@/components/documents/use-upload-files";
import type { ChatAttachment } from "@/lib/ai/types/chat-attachment";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";

export type LocalChatFile = {
	id: string;
	file: File;
	previewUrl: string;
};

const toChatAttachment = ({
	asset,
	source,
}: {
	asset: Pick<
		Asset,
		"id" | "title" | "fileType" | "size" | "bucket" | "prefix"
	>;
	source: ChatAttachment["source"];
}): ChatAttachment => ({
	assetId: asset.id,
	title: asset.title,
	fileType: asset.fileType,
	size: asset.size,
	bucket: asset.bucket,
	prefix: asset.prefix,
	source,
});

export const useChatAttachments = ({ limit = 8 }: { limit?: number } = {}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const localFilesRef = useRef<LocalChatFile[]>([]);

	const [localFiles, setLocalFiles] = useState<LocalChatFile[]>([]);
	const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
	const [assetPickerOpen, setAssetPickerOpen] = useState(false);

	const {
		uploadAsync,
		isPending: isUploading,
		reset: resetUploadState,
	} = useUploadFiles({
		route: "chatAttachment",
	});

	const { mutateAsync: finalizeUpload } = useMutation(
		orpc.storage.finalizeUpload.mutationOptions(),
	);

	const selectedAssetIds = useMemo(
		() => new Set(selectedAssets.map((asset) => asset.id)),
		[
			selectedAssets,
		],
	);

	const count = localFiles.length + selectedAssets.length;
	const canAttachMore = count < limit;

	useEffect(() => {
		localFilesRef.current = localFiles;
	}, [
		localFiles,
	]);

	useEffect(
		() => () => {
			for (const item of localFilesRef.current) {
				URL.revokeObjectURL(item.previewUrl);
			}
		},
		[],
	);

	const openUploadDialog = () => {
		fileInputRef.current?.click();
	};

	const clearLocalFiles = () => {
		setLocalFiles((current) => {
			for (const item of current) {
				URL.revokeObjectURL(item.previewUrl);
			}

			return [];
		});
	};

	const removeLocalFile = (id: string) => {
		setLocalFiles((current) => {
			const match = current.find((entry) => entry.id === id);
			if (match) {
				URL.revokeObjectURL(match.previewUrl);
			}

			return current.filter((entry) => entry.id !== id);
		});
	};

	const addFiles = (files: File[] | FileList) => {
		const incoming = Array.from(files);
		if (incoming.length === 0) {
			return;
		}

		const slotsRemaining = limit - (selectedAssets.length + localFiles.length);
		if (slotsRemaining <= 0) {
			toast.error(`You can only attach up to ${limit} files.`);
			return;
		}

		const accepted = incoming.slice(0, slotsRemaining).map((file) => ({
			id: nanoid(),
			file,
			previewUrl: URL.createObjectURL(file),
		}));

		if (incoming.length > slotsRemaining) {
			toast.warning(
				`Only ${slotsRemaining} more attachment${slotsRemaining > 1 ? "s" : ""} can be added.`,
			);
		}

		setLocalFiles((current) => [
			...current,
			...accepted,
		]);
	};

	const handleFileInputChange = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		if (event.target.files) {
			addFiles(event.target.files);
		}

		event.target.value = "";
	};

	const addAsset = (asset: Asset) => {
		if (selectedAssetIds.has(asset.id)) {
			return;
		}

		if (!canAttachMore) {
			toast.error(`You can only attach up to ${limit} files.`);
			return;
		}

		setSelectedAssets((current) => [
			...current,
			asset,
		]);
	};

	const removeSelectedAsset = (id: AssetId) => {
		setSelectedAssets((current) => current.filter((asset) => asset.id !== id));
	};

	const clearAttachments = () => {
		clearLocalFiles();
		setSelectedAssets([]);
		setAssetPickerOpen(false);
		resetUploadState();
	};

	const resolveAttachmentsForSend = async (): Promise<ChatAttachment[]> => {
		const uploadedAttachments: ChatAttachment[] = [];

		if (localFiles.length > 0) {
			const uploadResult = await uploadAsync(
				localFiles.map((entry) => entry.file),
			);

			if (uploadResult.files.length > 0) {
				await finalizeUpload({
					route: "chatAttachment",
					files: uploadResult.files.map((file) => ({
						objectKey: file.objectKey,
						objectMetadata: file.objectMetadata,
						name: file.name,
						size: file.size,
						type: file.type,
					})),
				});
			}

			for (const file of uploadResult.files) {
				const { objectMetadata } = file;
				if (
					!objectMetadata.id ||
					!objectMetadata.prefix ||
					!objectMetadata.bucket
				) {
					continue;
				}

				uploadedAttachments.push({
					assetId: objectMetadata.id as AssetId,
					title: file.name,
					fileType: file.type,
					size: file.size,
					bucket: objectMetadata.bucket as Asset["bucket"],
					prefix: objectMetadata.prefix,
					source: "upload",
				});
			}

			if (uploadResult.failedFiles.length > 0) {
				toast.warning(
					`${uploadResult.failedFiles.length} attachment${uploadResult.failedFiles.length > 1 ? "s" : ""} failed to upload.`,
				);
			}
		}

		const libraryAttachments = selectedAssets.map((asset) =>
			toChatAttachment({
				asset,
				source: "library",
			}),
		);

		const attachmentsMap = new Map<string, ChatAttachment>();
		for (const attachment of [
			...libraryAttachments,
			...uploadedAttachments,
		]) {
			attachmentsMap.set(attachment.assetId, attachment);
		}

		return Array.from(attachmentsMap.values());
	};

	return {
		fileInputRef,
		localFiles,
		selectedAssets,
		selectedAssetIds,
		canAttachMore,
		isUploading,
		assetPickerOpen,
		setAssetPickerOpen,
		openUploadDialog,
		handleFileInputChange,
		addAsset,
		removeLocalFile,
		removeSelectedAsset,
		clearAttachments,
		resolveAttachmentsForSend,
	};
};
