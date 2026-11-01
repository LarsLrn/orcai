import {
	FileTextIcon,
	ImageIcon,
	PaperclipIcon,
	TriangleAlertIcon,
	XIcon,
} from "lucide-react";
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

/** One attached file: a preview, its name, type and size, a notice when only its start was read, and an optional remove action. */
export const FileAttachment = ({
	title,
	mediaType,
	size,
	previewUrl,
	truncated,
	onRemove,
	className,
}: {
	title: string;
	mediaType: string;
	size: number;
	previewUrl?: string;
	truncated?: boolean;
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
				{truncated && (
					<AttachmentDescription className="flex items-start gap-1 whitespace-normal">
						<TriangleAlertIcon className="mt-px size-3 shrink-0 text-amber-600" />
						{m.chat_attachment_truncated_notice()}
					</AttachmentDescription>
				)}
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
