import { Suspense } from "react";
import { NavUser } from "@/components/account/nav-user";
import { NewChatButton } from "@/components/chat/new-chat-button";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatSidebarMenu } from "./chat-sidebar-menu";
import { ManageSidebarGroup } from "./manage-sidebar-group";
import { SidebarLogo } from "./sidebar-logo";

const AppSidebar = () => {
	return (
		<Sidebar id="tour-sidebar">
			<SidebarHeader>
				<SidebarLogo />
				<NewChatButton size="sm">New Chat</NewChatButton>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Chats</SidebarGroupLabel>
					<SidebarGroupContent>
						<Suspense
							fallback={<SkeletonsArray className="mt-2 max-h-8" count={6} />}
						>
							<ChatSidebarMenu />
						</Suspense>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarContent>
					<Suspense>
						<ManageSidebarGroup />
					</Suspense>
				</SidebarContent>
				<Suspense fallback={<Skeleton className="h-12 w-full" />}>
					<NavUser />
				</Suspense>
			</SidebarFooter>
		</Sidebar>
	);
};

export { AppSidebar };
