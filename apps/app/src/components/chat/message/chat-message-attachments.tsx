import {
	Attachment,
	AttachmentInfo,
	AttachmentPreview,
	Attachments,
} from "@/components/ai-elements/attachments";
import type { ChatAttachment } from "@/lib/ai/types/chat-attachment";

export const ChatMessageAttachments = ({
	attachments,
}: {
	attachments: ChatAttachment[];
}) => {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<Attachments variant="list" className="mb-2 w-full">
			{attachments.map((attachment) => (
				<Attachment
					className="bg-card"
					key={attachment.assetId}
					data={{
						id: attachment.assetId,
						type: "source-document",
						sourceId: attachment.assetId,
						title: attachment.title,
						filename: attachment.title,
						mediaType: attachment.fileType,
					}}
				>
					<AttachmentPreview />
					<AttachmentInfo showMediaType />
				</Attachment>
			))}
		</Attachments>
	);
};
