import { FileTextIcon, ImageIcon, PaperclipIcon, XIcon } from "lucide-react";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@/components/ui/attachment";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import { m } from "@/paraglide/messages";

const mediaIcon = (mediaType: string) => {
	if (mediaType.startsWith("image/")) {
		return ImageIcon;
	}
	if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
		return FileTextIcon;
	}
	return PaperclipIcon;
};

/** One attached file: a preview, its name, type and size, and an optional remove action. */
export const FileAttachment = ({
	title,
	mediaType,
	size,
	previewUrl,
	onRemove,
	className,
}: {
	title: string;
	mediaType: string;
	size: number;
	previewUrl?: string;
	onRemove?: () => void;
	className?: string;
}) => {
	const Icon = mediaIcon(mediaType);

	return (
		<Attachment size="sm" className={className}>
			{mediaType.startsWith("image/") && previewUrl ? (
				<AttachmentMedia variant="image">
					<img alt={title} src={previewUrl} />
				</AttachmentMedia>
			) : (
				<AttachmentMedia>
					<Icon />
				</AttachmentMedia>
			)}
			<AttachmentContent>
				<AttachmentTitle>{title}</AttachmentTitle>
				<AttachmentDescription>
					{getFileTypeLabel(mediaType)} · {formatFileSize(size)}
				</AttachmentDescription>
			</AttachmentContent>
			{onRemove && (
				<AttachmentActions>
					<AttachmentAction
						aria-label={m.ai_elements_attachment_remove_label({
							name: title,
						})}
						onClick={onRemove}
					>
						<XIcon />
					</AttachmentAction>
				</AttachmentActions>
			)}
		</Attachment>
	);
};
