import type { AssetId } from "@orcai/core";
import { getMimeTypeFromFileType } from "@orcai/s3";
import type { Asset, ChatMessageAttachment } from "@orcai/schema";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAssetIntake } from "@/components/documents/use-asset-intake";
import { m } from "@/paraglide/messages";

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
	source: ChatMessageAttachment["source"];
}): ChatMessageAttachment => ({
	assetId: asset.id,
	title: asset.title,
	fileType: getMimeTypeFromFileType(asset.fileType),
	size: asset.size,
	bucket: asset.bucket,
	prefix: asset.prefix,
	source,
});

export const useChatAttachments = ({
	limit = 8,
	initialAttachments = [],
}: {
	limit?: number;
	initialAttachments?: ChatMessageAttachment[];
} = {}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const localFilesRef = useRef<LocalChatFile[]>([]);

	const [localFiles, setLocalFiles] = useState<LocalChatFile[]>([]);
	// Already stored assets: picked from the library or carried over from an earlier message.
	const [selectedAttachments, setSelectedAttachments] =
		useState<ChatMessageAttachment[]>(initialAttachments);
	const [assetPickerOpen, setAssetPickerOpen] = useState(false);

	// Uploads become chat-origin assets when the message is sent.
	const {
		intake,
		isPending: isUploading,
		reset: resetUploadState,
	} = useAssetIntake({
		route: "chatAttachment",
	});

	const selectedAssetIds = useMemo(
		() => new Set(selectedAttachments.map((attachment) => attachment.assetId)),
		[
			selectedAttachments,
		],
	);

	const count = localFiles.length + selectedAttachments.length;
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

		const slotsRemaining =
			limit - (selectedAttachments.length + localFiles.length);
		if (slotsRemaining <= 0) {
			toast.error(
				m.chat_attachments_limit_toast_error({
					count: limit,
				}),
			);
			return;
		}

		const accepted = incoming.slice(0, slotsRemaining).map((file) => ({
			id: nanoid(),
			file,
			previewUrl: URL.createObjectURL(file),
		}));

		if (incoming.length > slotsRemaining) {
			toast.warning(
				m.chat_attachments_capacity_toast_warning({
					count: slotsRemaining,
				}),
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
			toast.error(
				m.chat_attachments_limit_toast_error({
					count: limit,
				}),
			);
			return;
		}

		setSelectedAttachments((current) => [
			...current,
			toChatAttachment({
				asset,
				source: "library",
			}),
		]);
	};

	const removeSelectedAsset = (id: AssetId) => {
		setSelectedAttachments((current) =>
			current.filter((attachment) => attachment.assetId !== id),
		);
	};

	const clearAttachments = () => {
		clearLocalFiles();
		setSelectedAttachments([]);
		setAssetPickerOpen(false);
		resetUploadState();
	};

	const resolveAttachmentsForSend = async (): Promise<
		ChatMessageAttachment[]
	> => {
		const uploadedAttachments: ChatMessageAttachment[] = [];

		if (localFiles.length > 0) {
			const { assets, failures } = await intake(
				localFiles.map((entry) => entry.file),
			);

			uploadedAttachments.push(
				...assets.map((asset) =>
					toChatAttachment({
						asset,
						source: "upload",
					}),
				),
			);

			if (failures.length > 0) {
				toast.warning(
					m.chat_attachments_upload_failed_toast_warning({
						count: failures.length,
					}),
				);
			}
		}

		const attachmentsMap = new Map<string, ChatMessageAttachment>();
		for (const attachment of [
			...selectedAttachments,
			...uploadedAttachments,
		]) {
			attachmentsMap.set(attachment.assetId, attachment);
		}

		return Array.from(attachmentsMap.values());
	};

	return {
		fileInputRef,
		localFiles,
		selectedAttachments,
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
