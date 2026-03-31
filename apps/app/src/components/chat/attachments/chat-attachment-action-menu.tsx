import { FolderOpenIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import {
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
} from "@/components/ai-elements/prompt-input";

export const ChatAttachmentActionMenu = ({
	disabled,
	onUploadFile,
	onSelectFromAssets,
}: {
	disabled: boolean;
	onUploadFile: () => void;
	onSelectFromAssets: () => void;
}) => {
	return (
		<PromptInputActionMenu>
			<PromptInputActionMenuTrigger type="button" disabled={disabled}>
				<PaperclipIcon className="size-4" />
				<span>Add file</span>
			</PromptInputActionMenuTrigger>
			<PromptInputActionMenuContent className="w-48">
				<PromptInputActionMenuItem onClick={onUploadFile}>
					<UploadIcon className="size-4" />
					<span>Upload file</span>
				</PromptInputActionMenuItem>
				<PromptInputActionMenuItem onClick={onSelectFromAssets}>
					<FolderOpenIcon className="size-4" />
					<span>From assets</span>
				</PromptInputActionMenuItem>
			</PromptInputActionMenuContent>
		</PromptInputActionMenu>
	);
};
