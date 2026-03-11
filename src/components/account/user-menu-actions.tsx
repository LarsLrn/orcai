import { Link } from "@tanstack/react-router";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { sidebarUserMenu } from "@/settings/menus";

const UserMenuActions = () => {
	const { closeMobileForNavigation } = useSidebar();

	return (
		<DropdownMenuGroup>
			{sidebarUserMenu.map((item) => (
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
