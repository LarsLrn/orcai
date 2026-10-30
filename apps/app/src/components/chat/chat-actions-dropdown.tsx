import type { ChatId } from "@orcai/core";
import type { ChatKind } from "@orcai/schema";
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
import { downloadChat } from "@/components/chat/chat-history";
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
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The open chat a title menu belongs to, which adds the actions that need it. */
type CurrentChat = {
	zedToken?: string;
	/** A read-only chat can still be pinned, downloaded and deleted. */
	readOnly: boolean;
};

const COPY = {
	chat: {
		rename: m.chat_actions_rename_action,
		renameTitle: m.chat_rename_dialog_title,
		download: m.chat_actions_download_action,
		downloadFailed: m.chat_download_failed_toast_error,
		deleteAction: m.chat_actions_delete_action,
		placeholder: m.chat_title_placeholder,
		deleteRedirectTo: "/app/chat",
	},
	assistant: {
		rename: m.assistant_conversation_rename_action,
		renameTitle: m.assistant_conversation_rename_dialog_title,
		download: m.assistant_conversation_download_action,
		downloadFailed: m.assistant_conversation_download_failed_toast_error,
		deleteAction: m.assistant_conversation_delete_action,
		placeholder: m.assistant_conversation_title_placeholder,
		deleteRedirectTo: "/app/assistant",
	},
} as const;

const ChatActionsDropdown = ({
	children,
	chatId,
	title,
	pinned,
	kind = "chat",
	current,
}: {
	children: React.ReactElement;
	chatId: ChatId;
	title: string | null;
	/** Whether the chat is pinned; omitted where chats cannot be pinned. */
	pinned?: boolean;
	/** An Assistant conversation has its own wording and no settings, pin or tour. */
	kind?: ChatKind;
	current?: CurrentChat;
}) => {
	const copy = COPY[kind];
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
						to: copy.deleteRedirectTo,
					});
				}
			},
		},
		{
			names: [
				title,
			],
			kind,
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
			await downloadChat({
				chatId,
				zedToken: current?.zedToken,
			});
		} catch (error) {
			toast.error(copy.downloadFailed(), {
				description: reasonMessageOf(error),
			});
		}
	};

	return (
		<>
			<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
				<DropdownMenuTrigger render={children} />
				<DropdownMenuContent align="end" className="w-48">
					{!current?.readOnly && (
						<DropdownMenuItem
							onClick={select(() => setIsRenameDialogOpen(true))}
						>
							<PencilIcon />
							{copy.rename()}
						</DropdownMenuItem>
					)}
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
					{kind === "chat" && current && !current.readOnly && (
						<DropdownMenuItem onClick={select(() => setIsSettingsOpen(true))}>
							<SettingsIcon />
							{m.chat_actions_settings_action()}
						</DropdownMenuItem>
					)}
					{current && (
						<DropdownMenuItem onClick={select(() => void handleDownload())}>
							<DownloadIcon />
							{copy.download()}
						</DropdownMenuItem>
					)}
					{kind === "chat" && current && <StartTourItem onSelect={select} />}
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
						{copy.deleteAction()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameDialog
				open={isRenameDialogOpen}
				onOpenChange={setIsRenameDialogOpen}
				initialValue={title}
				copy={{
					title: copy.renameTitle(),
					placeholder: copy.placeholder(),
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
			{kind === "chat" && current && (
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
			kind={chat.data.kind}
			current={{
				zedToken,
				readOnly: chat.data.readOnly !== null,
			}}
		>
			{children}
		</ChatActionsDropdown>
	);
};

export { ChatActionsDropdown, ChatTitleMenu };
