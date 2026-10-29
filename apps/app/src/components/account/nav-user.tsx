import { skipToken, useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut } from "lucide-react";
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
import { UserAvatar } from "@/components/users/user-avatar";
import { useSignOut } from "@/hooks/actions/use-sign-out";
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { UserMenuActions } from "./user-menu-actions";

const NavUser = () => {
	const { signOut } = useSignOut();
	const { auth } = useAuthenticatedRouteContext();
	const { data: activeOrganization } = useQuery(
		orpc.organization.find.queryOptions({
			input: auth.session.activeOrganizationId
				? {
						id: auth.session.activeOrganizationId,
					}
				: skipToken,
		}),
	);
	// The server renders the query as pending even when its data reaches the
	// browser before hydration, so the organisation waits for hydration.
	const hydrated = useHydrated();
	const organization = hydrated ? activeOrganization?.data : undefined;

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
								<UserAvatar user={auth.user} />
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{auth.user.name}
									</span>
									{organization && (
										<span className="truncate text-muted-foreground text-xs">
											{organization.name}
										</span>
									)}
								</div>
								<ChevronsUpDown className="ml-auto size-4" />
							</SidebarMenuButton>
						}
					/>
					<DropdownMenuContent
						className="min-w-56"
						align="end"
						sideOffset={4}
						positionMethod="fixed"
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<UserAvatar user={auth.user} />
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
								{m.account_user_menu_sign_out_action()}
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
};

export { NavUser };
