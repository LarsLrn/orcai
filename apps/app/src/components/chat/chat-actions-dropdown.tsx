import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { RenameDialog } from "@/components/ui/dialog/rename-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	useDeleteChatsMutation,
	useUpdateChatMutation,
} from "@/hooks/mutations/use-chat-mutation";
import { m } from "@/paraglide/messages";

const ChatActionsDropdown = ({
	children,
	chatId,
	title,
	deleteRedirectTo = "/app/chat",
}: {
	children: React.ReactElement;
	chatId: string;
	title: string | null;
	/** Where to go when the open chat is the one being deleted. */
	deleteRedirectTo?: "/app/chat" | "/app/assistant";
}) => {
	const params = useParams({
		strict: false,
	});
	const navigate = useNavigate();

	const { mutate: deleteChats } = useDeleteChatsMutation(
		{
			onMutate: async ({ refs }) => {
				const isCurrentChatSelected =
					!!params.chatId && refs.some((ref) => ref.id === params.chatId);

				// Navigate away before deleting to avoid rendering a deleted chat entry.
				if (isCurrentChatSelected) {
					await navigate({
						to: deleteRedirectTo,
					});
				}
			},
		},
		{
			names: [
				title,
			],
		},
	);
	const { mutateAsync: updateChat, isPending: isUpdatingChat } =
		useUpdateChatMutation();

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

	const onDelete = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setIsDropdownOpen(false);
		deleteChats({
			refs: [
				{
					id: chatId,
				},
			],
		});
	};

	const onUpdate = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setIsDropdownOpen(false);
		setIsRenameDialogOpen(true);
	};

	return (
		<>
			<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
				<DropdownMenuTrigger render={children} />
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem onClick={onUpdate}>
						{m.chat_actions_rename_action()}
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onClick={onDelete}>
						{m.chat_actions_delete_action()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameDialog
				open={isRenameDialogOpen}
				onOpenChange={setIsRenameDialogOpen}
				initialValue={title}
				copy={{
					title: m.chat_rename_dialog_title(),
					description: m.chat_rename_dialog_description(),
					placeholder: m.chat_title_placeholder(),
					submit: m.chat_rename_dialog_submit(),
				}}
				isSubmitting={isUpdatingChat}
				onSubmit={async (nextTitle) => {
					const result = await updateChat({
						id: chatId,
						title: nextTitle,
					});

					if (result.status === "success") {
						setIsRenameDialogOpen(false);
					}
				}}
			/>
		</>
	);
};

export { ChatActionsDropdown };
