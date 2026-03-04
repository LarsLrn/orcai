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

const ChatActionsDropdown = ({
	children,
	chatId,
	title,
}: {
	children: React.ReactElement;
	chatId: string;
	title: string | null;
}) => {
	const params = useParams({
		strict: false,
	});
	const navigate = useNavigate();

	const { mutate: deleteChats } = useDeleteChatsMutation({
		onMutate: async ({ refs }) => {
			const isCurrentChatSelected =
				!!params.chatId && refs.some((ref) => ref.id === params.chatId);

			// Navigate away before deleting to avoid rendering a deleted chat entry.
			if (isCurrentChatSelected) {
				await navigate({
					to: "/app/chat",
				});
			}
		},
	});
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
					<DropdownMenuItem onClick={onUpdate}>Rename Chat</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onClick={onDelete}>
						Delete Chat
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameDialog
				open={isRenameDialogOpen}
				onOpenChange={setIsRenameDialogOpen}
				initialValue={title}
				entityLabel="Chat"
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
