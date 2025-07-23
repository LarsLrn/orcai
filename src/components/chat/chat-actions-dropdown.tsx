import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useUmami } from "@/hooks/use-umami";
import { chatQueryOptions } from "@/lib/query-options/chat";

const ChatActionsDropdown = ({
	children,
	chatId,
	title,
}: {
	children: React.ReactElement;
	chatId: string;
	title: string | null;
}) => {
	const params = useParams({ strict: false });
	const navigate = useNavigate();
	const confirm = useConfirm();
	const { trackEvent } = useUmami();

	const { mutateAsync: updateChat } = useMutation(chatQueryOptions.update());

	const { mutateAsync: deleteChat } = useMutation(chatQueryOptions.delete());

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);

	const onDelete = async (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setIsDropdownOpen(false);

		const isConfirmed = await confirm({
			title: "Delete Chat",
			description: "Are you sure you want to delete this chat?",
			confirmText: "Delete",
			cancelText: "Cancel",
		});

		if (isConfirmed) {
			toast.promise(deleteChat({ refs: [{ id: chatId }] }), {
				loading: "Deleting chat...",
				success: () => {
					trackEvent("chat-delete", {
						chatId,
					});
					return "Chat deleted";
				},
				error: (error) => ({
					message: "Failed to delete chat",
					description: error.message,
				}),
			});

			if (params.chatId && params.chatId === chatId) {
				await navigate({ to: "/app/chat" });
			}
		}
	};

	const onUpdate = async (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setIsDropdownOpen(false);

		const isConfirmed = await confirm({
			title: "Rename Chat",
			description: "Enter a new name for this chat",
			contentSlot: (
				<Input
					ref={inputRef}
					placeholder="New chat name"
					defaultValue={title || ""}
					max={250}
					min={1}
					required
				/>
			),
			confirmText: "Rename",
			cancelText: "Cancel",
		});

		if (isConfirmed) {
			const newTitle = inputRef.current?.value || "";
			toast.promise(updateChat({ id: chatId, title: newTitle }), {
				loading: "Renaming chat...",
				success: "Chat renamed",
				error: (error) => ({
					message: "Failed to rename chat",
					description: error.message,
				}),
			});
		}
	};

	return (
		<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[160px]">
				<DropdownMenuItem onClick={onUpdate}>Rename Chat</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={onDelete}>
					Delete Chat
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { ChatActionsDropdown };
