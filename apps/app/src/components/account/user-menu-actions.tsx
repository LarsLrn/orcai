import { Link, useRouterState } from "@tanstack/react-router";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsInstanceAdmin } from "@/hooks/authz/use-instance-admin";
import {
	instanceAdministrationUserMenuItem,
	sidebarUserMenu,
} from "@/settings/menus";

const UserMenuActions = () => {
	const { closeMobileForNavigation } = useSidebar();
	const isInstanceAdmin = useIsInstanceAdmin();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const menu =
		isInstanceAdmin && !pathname.startsWith("/instance")
			? [
					...sidebarUserMenu,
					instanceAdministrationUserMenuItem,
				]
			: sidebarUserMenu;

	return (
		<DropdownMenuGroup>
			{menu.map((item) => (
				<DropdownMenuItem
					key={item.title}
					render={
						<Link {...item.linkProps} onClick={closeMobileForNavigation}>
							<item.icon className="hover:text-foreground" />
							{item.title}
						</Link>
					}
				/>
			))}
		</DropdownMenuGroup>
	);
};

export { UserMenuActions };
