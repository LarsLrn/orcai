import type { AssetId } from "@orcai/core";
import type { ChatMessageAttachment } from "@orcai/schema";
import { FileAttachment } from "@/components/ai-elements/attachments";
import { AttachmentGroup } from "@/components/ui/attachment";
import { InputGroupAddon } from "@/components/ui/input-group";
import type { LocalChatFile } from "./use-chat-attachments";

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
