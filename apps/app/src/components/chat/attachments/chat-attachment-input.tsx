import type { AssetId } from "@orcai/core";
import type { ChatMessageAttachment } from "@orcai/schema";
import type { ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileAttachment } from "@/components/ai-elements/attachments";
import { AttachmentGroup } from "@/components/ui/attachment";
import { InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CHAT_ATTACHMENT_DROP_ACCEPT } from "@/settings/constants";
import type { LocalChatFile } from "./use-chat-attachments";

/** Takes files dropped anywhere on the composer, with the upload button's file types. */
export const ChatComposerDropZone = ({
	onFiles,
	disabled,
	className,
	children,
}: {
	onFiles: (files: File[]) => void;
	disabled?: boolean;
	className?: string;
	children: ReactNode;
}) => {
	const { getRootProps, isDragActive } = useDropzone({
		accept: CHAT_ATTACHMENT_DROP_ACCEPT,
		noClick: true,
		noKeyboard: true,
		// `disabled` would mark the whole composer as disabled.
		noDrag: disabled,
		onDrop: (accepted, rejected) => {
			onFiles(accepted);
			for (const { file } of rejected) {
				toast.error(
					m.chat_attachments_rejected_toast_error({
						name: file.name,
					}),
				);
			}
		},
	});

	return (
		<div
			{...getRootProps({
				className: cn("relative", className),
			})}
		>
			{children}
			{isDragActive && (
				<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-primary border-dashed bg-card/90 font-medium text-sm">
					{m.chat_composer_drop_label()}
				</div>
			)}
		</div>
	);
};

export const ChatComposerAttachments = ({
	localFiles,
	attachments,
	onRemoveLocalFile,
	onRemoveAsset,
}: {
	localFiles: LocalChatFile[];
	attachments: ChatMessageAttachment[];
	onRemoveLocalFile: (id: string) => void;
	onRemoveAsset: (id: AssetId) => void;
}) => {
	if (localFiles.length === 0 && attachments.length === 0) {
		return null;
	}

	return (
		<InputGroupAddon align="block-end">
			<AttachmentGroup className="w-full">
				{localFiles.map((file) => (
					<FileAttachment
						key={file.id}
						title={file.file.name}
						mediaType={file.file.type}
						size={file.file.size}
						previewUrl={file.previewUrl}
						onRemove={() => onRemoveLocalFile(file.id)}
					/>
				))}
				{attachments.map((attachment) => (
					<FileAttachment
						key={attachment.assetId}
						title={attachment.title}
						mediaType={attachment.fileType}
						size={attachment.size}
						onRemove={() => onRemoveAsset(attachment.assetId)}
					/>
				))}
			</AttachmentGroup>
		</InputGroupAddon>
	);
};
