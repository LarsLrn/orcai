import { Link } from "@tanstack/react-router";
import { NavUser } from "@/components/account/nav-user";
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
						<ChatSidebarMenu />
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarContent>
					<ManageSidebarGroup />
				</SidebarContent>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
};

export { AppSidebar };
