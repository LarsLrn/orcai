import type { ChatListRow } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { MessagesSquareIcon, MoreHorizontalIcon } from "lucide-react";
import { BranchMark } from "@/components/chat/branch-links";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { SimplePlaceholder } from "@/components/placeholders/simple-placeholder";
import { Button } from "@/components/ui/button";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const PAGE_SIZE = 40;

const ChatMenuItem = ({ chat }: { chat: ChatListRow }) => {
	const { closeMobileForNavigation } = useSidebar();
	const { chatId: activeChatId } = useParams({
		strict: false,
	});

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={chat.id === activeChatId}
				className="border"
				render={
					<Link
						to={"/app/chat/$chatId"}
						params={{
							chatId: chat.id,
						}}
						onClick={closeMobileForNavigation}
					>
						{chat.parentChatId && <BranchMark />}
						<span className="truncate">
							{chat.title ?? m.chat_title_placeholder()}
						</span>
					</Link>
				}
			/>
			<ChatActionsDropdown
				chatId={chat.id}
				title={chat.title}
				pinned={chat.pinnedAt !== null}
			>
				<SidebarMenuAction
					className={cn(chat.id === activeChatId && "text-accent-foreground")}
				>
					<MoreHorizontalIcon />
					<span className="sr-only">
						{m.sidebar_chat_actions_aria_label({
							title: chat.title ?? m.chat_title_placeholder(),
						})}
					</span>
				</SidebarMenuAction>
			</ChatActionsDropdown>
		</SidebarMenuItem>
	);
};

/** The sidebar's chats, pinned ones in their own group above the most recent. */
const ChatSidebarGroups = () => {
	const { closeMobileForNavigation } = useSidebar();
	const { data, status, refetch, isRefetching } = useQuery(
		orpc.chat.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
			},
		}),
	);
	const chats = data?.data ?? [];
	const pinned = chats.filter((chat) => chat.pinnedAt !== null);
	const recent = chats.filter((chat) => chat.pinnedAt === null);

	const recentContent = () => {
		if (status === "pending") {
			return <Spinner className="mx-auto my-4" />;
		}

		if (status === "error") {
			return (
				<SimplePlaceholder Icon={MessagesSquareIcon} variant="muted">
					<span className="block">{m.sidebar_chats_error_title()}</span>
					<Button
						variant="outline"
						size="sm"
						className="mt-3"
						loading={isRefetching}
						onClick={() => refetch()}
					>
						{m.sidebar_chats_error_retry_button()}
					</Button>
				</SimplePlaceholder>
			);
		}

		if (chats.length === 0) {
			return (
				<SimplePlaceholder Icon={MessagesSquareIcon} variant="muted">
					{m.sidebar_chats_empty_state_title()}
				</SimplePlaceholder>
			);
		}

		return (
			<SidebarMenu>
				{recent.map((chat) => (
					<ChatMenuItem key={chat.id} chat={chat} />
				))}
				{data.rowCount > PAGE_SIZE && (
					<SidebarMenuItem>
						<SidebarMenuButton
							size="sm"
							className="text-muted-foreground"
							render={
								<Link to="/app/chat" onClick={closeMobileForNavigation}>
									{m.sidebar_chats_show_all_link({
										count: data.rowCount,
									})}
								</Link>
							}
						/>
					</SidebarMenuItem>
				)}
			</SidebarMenu>
		);
	};

	return (
		<>
			{pinned.length > 0 && (
				<SidebarGroup
					role="group"
					aria-label={m.sidebar_chats_pinned_group_label()}
				>
					<SidebarGroupLabel>
						{m.sidebar_chats_pinned_group_label()}
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{pinned.map((chat) => (
								<ChatMenuItem key={chat.id} chat={chat} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			)}
			<SidebarGroup role="group" aria-label={m.sidebar_chats_group_label()}>
				<SidebarGroupLabel className="flex justify-between">
					<span>{m.sidebar_chats_group_label()}</span>
					<Link to="/app/chat" className="hover:underline">
						{m.common_show_all_action()}
					</Link>
				</SidebarGroupLabel>
				<SidebarGroupContent>{recentContent()}</SidebarGroupContent>
			</SidebarGroup>
		</>
	);
};

export { ChatSidebarGroups };
