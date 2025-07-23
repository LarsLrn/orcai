import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { SignOutButton } from "@/components/auth/signout-button";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { organizationQueryOptions } from "@/lib/query-options/organization";
import { getNameInitial } from "@/lib/utils";
import { UserMenuActions } from "./user-menu-actions";

const NavUser = () => {
	const { data: organisations } = useQuery(
		organizationQueryOptions.list({ input: { pageIndex: 0, pageSize: 6 } }),
	);
	const { auth } = useRouteContext({ from: "/app" });

	const activeOrganization = organisations?.data.find(
		(org) => org.id === auth.session.activeOrganizationId,
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							closeSidebar={false}
							className="border bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground dark:bg-background/50"
						>
							<Avatar className="size-8 rounded-lg">
								<AvatarImage
									src={auth.user.image ?? undefined}
									alt={auth.user.name}
								/>
								<AvatarFallback className="rounded-lg">
									{getNameInitial(auth.user.name)}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{auth.user.name}</span>
								{activeOrganization && (
									<span className="truncate text-xs">
										{activeOrganization.name}
									</span>
								)}
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="size-8 rounded-lg">
									<AvatarImage
										src={auth.user.image ?? undefined}
										alt={auth.user.name}
									/>
									<AvatarFallback className="rounded-lg">
										{getNameInitial(auth.user.name)}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{auth.user.name}
									</span>
									<span className="truncate text-xs">{auth.user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<UserMenuActions />
						<DropdownMenuSeparator />
						<OrganizationSwitcher />
						<DropdownMenuSeparator />
						<SignOutButton asChild>
							<DropdownMenuItem
								variant="destructive"
								className="flex items-center gap-2"
							>
								<LogOut />
								Sign Out
							</DropdownMenuItem>
						</SignOutButton>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
};

export { NavUser };
