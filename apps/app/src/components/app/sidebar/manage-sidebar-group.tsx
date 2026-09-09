import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
} from "@/components/ui/sidebar";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { sidebarMenu } from "@/settings/menus";
import { CollapsibleSidebarMenu } from "./collapsible-sidebar-menu";

const ManageSidebarGroup = () => {
	const { data } = useOrganizationCapabilities();
	const capabilities = data?.data.capabilities;
	const visibleMenu = sidebarMenu
		.map((item) => {
			const items = item.items?.filter(
				(subItem) =>
					!subItem.requires || hasCapability(capabilities, subItem.requires),
			);
			const canShowItem =
				!item.requires || hasCapability(capabilities, item.requires);

			if (item.items && !items?.length) {
				return item.linkProps && canShowItem
					? {
							...item,
							items: undefined,
						}
					: undefined;
			}

			if (!canShowItem) {
				return undefined;
			}

			return items
				? {
						...item,
						items,
					}
				: item;
		})
		.filter((item): item is (typeof sidebarMenu)[number] => !!item);

	if (visibleMenu.length === 0) {
		return null;
	}

	return (
		<SidebarGroup className="p-0">
			<SidebarGroupLabel>Your workspace</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{visibleMenu.map((item) => (
						<CollapsibleSidebarMenu key={item.title} item={item} />
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
};

export { ManageSidebarGroup };
