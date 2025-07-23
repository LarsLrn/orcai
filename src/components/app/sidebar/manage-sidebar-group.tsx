import { Link } from "@tanstack/react-router";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { sidebarMenu } from "@/settings/menus";

const ManageSidebarGroup = () => {
	return (
		<SidebarGroup className="p-0">
			<SidebarGroupLabel>Manage</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{sidebarMenu.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild>
								<Link {...item.linkProps}>
									<item.icon />
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
};

export { ManageSidebarGroup };
