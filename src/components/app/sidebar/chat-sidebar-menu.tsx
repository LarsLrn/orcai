import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessagesSquareIcon, MoreHorizontalIcon } from "lucide-react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { SimplePlaceholder } from "@/components/placeholders/simple-placeholder";
import {
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { chatQueryOptions } from "@/lib/query-options/chat";

const ChatSidebarMenu = () => {
	const { data, status, error } = useQuery(
		chatQueryOptions.list({
			input: { pageIndex: 0, pageSize: 100 },
		}),
	);

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
					<SidebarMenuButton asChild>
						<Link to={"/app/chat/$chatId"} params={{ chatId: chat.id }}>
							<span className="truncate">{chat.title}</span>
						</Link>
					</SidebarMenuButton>
					<ChatActionsDropdown chatId={chat.id} title={chat.title}>
						<SidebarMenuAction>
							<MoreHorizontalIcon />
						</SidebarMenuAction>
					</ChatActionsDropdown>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
};

export { ChatSidebarMenu };
