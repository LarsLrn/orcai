import { Link } from "@tanstack/react-router";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { sidebarUserMenu } from "@/settings/menus";

const UserMenuActions = () => {
	const { setOpenMobile } = useSidebar();

	return (
		<DropdownMenuGroup>
			{sidebarUserMenu.map((item) => (
				<DropdownMenuItem key={item.url} asChild>
					<Link to={item.url} onClick={() => setOpenMobile(false)}>
						<item.icon className="hover:text-foreground" />
						{item.title}
					</Link>
				</DropdownMenuItem>
			))}
		</DropdownMenuGroup>
	);
};

export { UserMenuActions };
