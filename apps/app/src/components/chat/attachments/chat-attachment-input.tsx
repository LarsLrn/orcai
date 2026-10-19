import type { AssetId } from "@orcai/core";
import type { ChatMessageAttachment } from "@orcai/schema";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
import {
	Attachment,
	type AttachmentData,
	AttachmentHoverCard,
	AttachmentHoverCardContent,
	AttachmentHoverCardTrigger,
	AttachmentInfo,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
} from "@/components/ai-elements/attachments";
import { InputGroupAddon } from "@/components/ui/input-group";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import type { LocalChatFile } from "./use-chat-attachments";

const localFileToUiPart = (file: LocalChatFile) =>
	({
		id: file.id,
		type: "file",
		filename: file.file.name,
		mediaType: file.file.type,
		url: file.previewUrl,
	}) satisfies FileUIPart & {
		id: string;
	};

const attachmentToUiPart = (attachment: ChatMessageAttachment) =>
	({
		id: attachment.assetId,
		type: "source-document",
		sourceId: attachment.assetId,
		mediaType: attachment.fileType,
		title: attachment.title,
		filename: attachment.title,
	}) satisfies SourceDocumentUIPart & {
		id: string;
	};

const AttachmentNode = ({
	key,
	data,
	title,
	fileType,
	size,
	onRemove,
}: {
	key: string;
	data: AttachmentData;
	title: string;
	fileType: string;
	size: number;
	onRemove: () => void;
}) => {
	return (
		<AttachmentHoverCard key={key}>
			<AttachmentHoverCardTrigger
				render={
					<Attachment data={data} onRemove={onRemove}>
						<div className="relative size-5 shrink-0">
							<div className="absolute inset-0 transition-opacity group-hover:opacity-0">
								<AttachmentPreview />
							</div>
							<AttachmentRemove className="absolute inset-0" />
						</div>
						<AttachmentInfo />
					</Attachment>
				}
			/>
			<AttachmentHoverCardContent>
				<div className="space-y-3">
					<div className="space-y-1 px-0.5">
						<h4 className="font-semibold text-sm leading-none">{title}</h4>

						<p className="font-mono text-muted-foreground text-xs">
							{getFileTypeLabel(fileType)} · {formatFileSize(size)}
						</p>
					</div>
				</div>
			</AttachmentHoverCardContent>
		</AttachmentHoverCard>
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
		<InputGroupAddon align="block-end" className="flex-wrap gap-1">
			<Attachments variant="inline">
				{localFiles.map((file) => (
					<AttachmentNode
						key={file.id}
						data={localFileToUiPart(file)}
						title={file.file.name}
						fileType={file.file.type}
						size={file.file.size}
						onRemove={() => onRemoveLocalFile(file.id)}
					/>
				))}
				{attachments.map((attachment) => (
					<AttachmentNode
						key={attachment.assetId}
						data={attachmentToUiPart(attachment)}
						title={attachment.title}
						fileType={attachment.fileType}
						size={attachment.size}
						onRemove={() => onRemoveAsset(attachment.assetId)}
					/>
				))}
			</Attachments>
		</InputGroupAddon>
	);
};
