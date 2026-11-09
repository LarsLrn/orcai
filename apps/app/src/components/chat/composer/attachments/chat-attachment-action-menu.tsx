import { FolderOpenIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
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
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<InputGroupButton
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={disabled}
						aria-label={m.chat_attachment_menu_trigger()}
						className="text-muted-foreground rounded-full"
					/>
				}
			>
				<PaperclipIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuItem onClick={onUploadFile}>
					<UploadIcon className="size-4" />
					<span>{m.chat_attachment_menu_upload_action()}</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onSelectFromAssets}>
					<FolderOpenIcon className="size-4" />
					<span>{m.chat_attachment_menu_assets_action()}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
