import type { ChatId } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
	CompassIcon,
	DownloadIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	SettingsIcon,
	Trash2Icon,
} from "lucide-react";
import { cloneElement, useState } from "react";
import { toast } from "sonner";
import { downloadConversation } from "@/components/ai-elements/conversation";
import { fetchWholeChat } from "@/components/chat/chat-history";
import { ChatSettings } from "@/components/chat/chat-settings";
import { useTour } from "@/components/tour/tour-provider";
import { RenameDialog } from "@/components/ui/dialog/rename-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	useDeleteChatsMutation,
	usePinChatMutation,
	useUpdateChatMutation,
} from "@/hooks/mutations/use-chat-mutation";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The open chat a title menu belongs to, which adds the actions that need it. */
type CurrentChat = {
	zedToken?: string;
	variant: "chat" | "assistant";
};

const ChatActionsDropdown = ({
	children,
	chatId,
	title,
	pinned,
	deleteRedirectTo = "/app/chat",
	current,
}: {
	children: React.ReactElement;
	chatId: ChatId;
	title: string | null;
	/** Whether the chat is pinned; omitted where chats cannot be pinned. */
	pinned?: boolean;
	/** Where to go when the open chat is the one being deleted. */
	deleteRedirectTo?: "/app/chat" | "/app/assistant";
	current?: CurrentChat;
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
	const { mutate: pinChat } = usePinChatMutation();

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

	// Rows sit inside links, which must not follow a click on the menu.
	const select =
		(action: () => void) => (event: React.MouseEvent<HTMLElement>) => {
			event.stopPropagation();
			setIsDropdownOpen(false);
			action();
		};

	const handleDownload = async () => {
		try {
			const messages = await fetchWholeChat({
				chatId,
				zedToken: current?.zedToken,
			});
			downloadConversation(transcriptMarkdown(messages));
		} catch (error) {
			toast.error(m.chat_download_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
		}
	};

	return (
		<>
			<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
				<DropdownMenuTrigger render={children} />
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem onClick={select(() => setIsRenameDialogOpen(true))}>
						<PencilIcon />
						{m.chat_actions_rename_action()}
					</DropdownMenuItem>
					{pinned !== undefined && (
						<DropdownMenuItem
							onClick={select(() =>
								pinChat({
									id: chatId,
									pinned: !pinned,
								}),
							)}
						>
							{pinned ? <PinOffIcon /> : <PinIcon />}
							{pinned
								? m.chat_actions_unpin_action()
								: m.chat_actions_pin_action()}
						</DropdownMenuItem>
					)}
					{current?.variant === "chat" && (
						<DropdownMenuItem onClick={select(() => setIsSettingsOpen(true))}>
							<SettingsIcon />
							{m.chat_actions_settings_action()}
						</DropdownMenuItem>
					)}
					{current && (
						<DropdownMenuItem onClick={select(() => void handleDownload())}>
							<DownloadIcon />
							{m.chat_actions_download_action()}
						</DropdownMenuItem>
					)}
					{current?.variant === "chat" && <StartTourItem onSelect={select} />}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={select(() =>
							deleteChats({
								refs: [
									{
										id: chatId,
									},
								],
							}),
						)}
					>
						<Trash2Icon />
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
			{current?.variant === "chat" && (
				<ChatSettings
					chatId={chatId}
					zedToken={current.zedToken}
					open={isSettingsOpen}
					onOpenChange={setIsSettingsOpen}
				/>
			)}
		</>
	);
};

const StartTourItem = ({
	onSelect,
}: {
	onSelect: (
		action: () => void,
	) => (event: React.MouseEvent<HTMLElement>) => void;
}) => {
	const { start } = useTour("chatTour");

	return (
		<DropdownMenuItem onClick={onSelect(start)}>
			<CompassIcon />
			{m.chat_actions_tour_action()}
		</DropdownMenuItem>
	);
};

/** The header title menu of a chat or assistant page, over the chat the page has loaded. */
const ChatTitleMenu = ({
	children,
}: {
	children: React.ReactElement<{
		disabled?: boolean;
	}>;
}) => {
	const { chatId } = useParams({
		strict: false,
	});
	const { zedToken } = useSearch({
		strict: false,
	});
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: chatId
				? {
						id: chatId,
						zedToken,
					}
				: skipToken,
		}),
	);

	if (!chat) {
		return cloneElement(children, {
			disabled: true,
		});
	}

	const isAssistant = chat.data.kind === "assistant";

	return (
		<ChatActionsDropdown
			chatId={chat.data.id}
			title={chat.data.title}
			pinned={isAssistant ? undefined : chat.data.pinnedAt !== null}
			deleteRedirectTo={isAssistant ? "/app/assistant" : "/app/chat"}
			current={{
				zedToken,
				variant: isAssistant ? "assistant" : "chat",
			}}
		>
			{children}
		</ChatActionsDropdown>
	);
};

export { ChatActionsDropdown, ChatTitleMenu };
