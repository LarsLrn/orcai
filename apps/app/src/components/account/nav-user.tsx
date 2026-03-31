import { getInitial } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
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
import { useSignOut } from "@/hooks/actions/use-sign-out";
import { orpc } from "@/lib/orpc/orpc";
import { UserMenuActions } from "./user-menu-actions";

const NavUser = () => {
	const { signOut } = useSignOut();
	const { data: organisations } = useQuery(
		orpc.organization.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 6,
			},
		}),
	);
	const { auth } = useRouteContext({
		from: "/app",
	});

	const activeOrganization = organisations?.data.find(
		(org) => org.id === auth.session.activeOrganizationId,
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="border bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground dark:bg-background/50"
							>
								<Avatar className="size-8 rounded-lg">
									<AvatarImage
										src={auth.user.image ?? undefined}
										alt={auth.user.name}
									/>
									<AvatarFallback className="rounded-lg">
										{getInitial(auth.user.name)}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{auth.user.name}
									</span>
									{activeOrganization && (
										<span className="truncate text-xs">
											{activeOrganization.name}
										</span>
									)}
								</div>
								<ChevronsUpDown className="ml-auto size-4" />
							</SidebarMenuButton>
						}
					/>
					<DropdownMenuContent className="min-w-56" align="end" sideOffset={4}>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="size-8">
										<AvatarImage
											src={auth.user.image ?? undefined}
											alt={auth.user.name}
										/>
										<AvatarFallback>
											{getInitial(auth.user.name)}
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
							<DropdownMenuItem variant="destructive" onClick={() => signOut()}>
								<LogOut />
								Sign Out
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
};

export { NavUser };
