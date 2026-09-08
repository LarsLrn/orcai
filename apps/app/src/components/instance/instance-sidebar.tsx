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

const instanceNavigation: {
	title: string;
	to: "/instance/organizations" | "/instance/users";
	icon: LucideIcon;
}[] = [
	{
		title: "Organisations",
		to: "/instance/organizations",
		icon: Building2Icon,
	},
	{
		title: "Users",
		to: "/instance/users",
		icon: UsersIcon,
	},
];

const InstanceSidebar = () => {
	const { closeMobileForNavigation } = useSidebar();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<Sidebar variant="floating">
			<SidebarHeader>
				<SidebarLogo homeTo="/instance" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Manage instance</SidebarGroupLabel>
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
									<span>Back to app</span>
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
