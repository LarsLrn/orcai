import { FolderOpenIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import {
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
} from "@/components/ai-elements/prompt-input";
import { m } from "@/paraglide/messages";

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
				<span>{m.chat_attachment_menu_trigger()}</span>
			</PromptInputActionMenuTrigger>
			<PromptInputActionMenuContent className="w-48">
				<PromptInputActionMenuItem onClick={onUploadFile}>
					<UploadIcon className="size-4" />
					<span>{m.chat_attachment_menu_upload_action()}</span>
				</PromptInputActionMenuItem>
				<PromptInputActionMenuItem onClick={onSelectFromAssets}>
					<FolderOpenIcon className="size-4" />
					<span>{m.chat_attachment_menu_assets_action()}</span>
				</PromptInputActionMenuItem>
			</PromptInputActionMenuContent>
		</PromptInputActionMenu>
	);
};
