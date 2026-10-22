import { Link } from "@tanstack/react-router";
import { NavUser } from "@/components/account/nav-user";
import { buttonVariants } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	useSidebar,
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";
import { ChatSidebarGroups } from "./chat-sidebar-groups";
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
				<ChatSidebarGroups />
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
