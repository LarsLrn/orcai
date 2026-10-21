import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { NavUser } from "@/components/account/nav-user";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
import { buttonVariants } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { ChatSidebarMenu } from "./chat-sidebar-menu";
import { ManageSidebarGroup } from "./manage-sidebar-group";
import { SidebarLogo } from "./sidebar-logo";

const AppSidebar = () => {
	const { isMobile, closeMobileForNavigation } = useSidebar();

	return (
		<Sidebar variant="floating">
			<SidebarHeader>
				<SidebarLogo />
				<Link
					to="/app/chat/setup"
					className={buttonVariants({
						size: "sm",
					})}
					onClick={() => isMobile && closeMobileForNavigation()}
				>
					{m.sidebar_start_chat_button()}
				</Link>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className="flex justify-between">
						<span>{m.sidebar_chats_group_label()}</span>
						<Link to="/app/chat" className="hover:underline">
							{m.common_show_all_action()}
						</Link>
					</SidebarGroupLabel>
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
