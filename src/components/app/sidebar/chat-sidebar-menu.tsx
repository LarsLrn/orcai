import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { MessagesSquareIcon, MoreHorizontalIcon } from "lucide-react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { SimplePlaceholder } from "@/components/placeholders/simple-placeholder";
import {
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const ChatSidebarMenu = () => {
	const { data, status, error } = useQuery(
		orpc.chat.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);

	const { chatId: activeChatId } = useParams({
		strict: false,
	});

	if (status === "pending") {
		return <div>Loading...</div>;
	}

	if (status === "error") {
		return (
			<SimplePlaceholder variant="muted">{error.message}</SimplePlaceholder>
		);
	}

	const chats = data.data;

	if (!chats || chats.length === 0) {
		return (
			<SimplePlaceholder Icon={MessagesSquareIcon} variant="muted">
				Your chats will appear here
			</SimplePlaceholder>
		);
	}

	return (
		<SidebarMenu>
			{chats.map((chat) => (
				<SidebarMenuItem key={chat.id}>
					<SidebarMenuButton
						isActive={chat.id === activeChatId}
						className="border"
						render={
							<Link
								to={"/app/chat/$chatId"}
								params={{
									chatId: chat.id,
								}}
							>
								<span className="truncate">{chat.title}</span>
							</Link>
						}
					/>
					<ChatActionsDropdown chatId={chat.id} title={chat.title}>
						<SidebarMenuAction
							className={cn(
								chat.id === activeChatId && "text-accent-foreground",
							)}
						>
							<MoreHorizontalIcon />
						</SidebarMenuAction>
					</ChatActionsDropdown>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
};

export { ChatSidebarMenu };
