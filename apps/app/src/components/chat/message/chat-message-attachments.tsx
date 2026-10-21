import type { ChatMessageAttachment } from "@orcai/schema";
import { FileAttachment } from "@/components/ai-elements/attachments";
import { AttachmentGroup } from "@/components/ui/attachment";

export const ChatMessageAttachments = ({
	attachments,
}: {
	attachments: ChatMessageAttachment[];
}) => {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<AttachmentGroup className="mb-2">
			{attachments.map((attachment) => (
				<FileAttachment
					key={attachment.assetId}
					title={attachment.title}
					mediaType={attachment.fileType}
					size={attachment.size}
				/>
			))}
		</AttachmentGroup>
	);
};
