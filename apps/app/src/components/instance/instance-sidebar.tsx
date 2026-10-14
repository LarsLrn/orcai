import { Link, useRouterState } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	Building2Icon,
	type LucideIcon,
	UsersIcon,
} from "lucide-react";
import { Suspense } from "react";
import { NavUser } from "@/components/account/nav-user";
import { SidebarLogo } from "@/components/app/sidebar/sidebar-logo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";

const InstanceSidebar = () => {
	const { closeMobileForNavigation } = useSidebar();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	const instanceNavigation: {
		title: string;
		to: "/instance/organizations" | "/instance/users";
		icon: LucideIcon;
	}[] = [
		{
			title: m.instance_sidebar_organisations_nav_label(),
			to: "/instance/organizations",
			icon: Building2Icon,
		},
		{
			title: m.instance_sidebar_users_nav_label(),
			to: "/instance/users",
			icon: UsersIcon,
		},
	];

	return (
		<Sidebar variant="floating">
			<SidebarHeader>
				<SidebarLogo homeTo="/instance" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>
						{m.instance_sidebar_manage_group_label()}
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{instanceNavigation.map((item) => (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										isActive={pathname.startsWith(item.to)}
										render={
											<Link to={item.to} onClick={closeMobileForNavigation}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										}
									/>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={
								<Link to="/app" onClick={closeMobileForNavigation}>
									<ArrowLeftRightIcon />
									<span>{m.instance_sidebar_back_to_app_action()}</span>
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
				<Suspense fallback={<Skeleton className="h-12 w-full" />}>
					<NavUser />
				</Suspense>
			</SidebarFooter>
		</Sidebar>
	);
};

export { InstanceSidebar };
