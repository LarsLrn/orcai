import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { MessagesSquareIcon, MoreHorizontalIcon } from "lucide-react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { SimplePlaceholder } from "@/components/placeholders/simple-placeholder";
import { Button } from "@/components/ui/button";
import {
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const ChatSidebarMenu = () => {
	const { closeMobileForNavigation } = useSidebar();
	const { data, status, refetch, isRefetching } = useQuery(
		orpc.chat.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 40,
			},
		}),
	);

	const { chatId: activeChatId } = useParams({
		strict: false,
	});

	if (status === "pending") {
		return <Spinner className="mx-auto my-4" />;
	}

	if (status === "error") {
		return (
			<SimplePlaceholder Icon={MessagesSquareIcon} variant="muted">
				<span className="block">Your chats could not be loaded</span>
				<Button
					variant="outline"
					size="sm"
					className="mt-3"
					disabled={isRefetching}
					onClick={() => refetch()}
				>
					Try again
				</Button>
			</SimplePlaceholder>
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
								onClick={closeMobileForNavigation}
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
							<span className="sr-only">Chat actions for {chat.title}</span>
						</SidebarMenuAction>
					</ChatActionsDropdown>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
};

export { ChatSidebarMenu };
