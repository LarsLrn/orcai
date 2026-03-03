import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { sidebarMenu } from "@/settings/menus";

const CollapsibleSidebarMenu = ({
	item,
}: {
	item: (typeof sidebarMenu)[number];
}) => {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<Collapsible
			key={item.title}
			open={
				item.linkProps.to === pathname ||
				item.items?.some((sub) => sub.linkProps.to === pathname)
			}
			render={
				<SidebarMenuItem>
					<SidebarMenuButton
						render={
							<Link {...item.linkProps}>
								<item.icon />
								<span>{item.title}</span>
							</Link>
						}
					/>

					{item.items?.length ? (
						<>
							<CollapsibleTrigger
								render={
									<SidebarMenuAction className="data-panel-open:rotate-90">
										<ChevronRightIcon />
										<span className="sr-only">Toggle</span>
									</SidebarMenuAction>
								}
							/>
							<CollapsibleContent>
								<SidebarMenuSub>
									{item.items?.map((subItem) => (
										<SidebarMenuSubItem key={subItem.title}>
											<SidebarMenuSubButton
												render={
													<Link {...subItem.linkProps}>
														<subItem.icon />
														<span>{subItem.title}</span>
													</Link>
												}
											/>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</>
					) : null}
				</SidebarMenuItem>
			}
		/>
	);
};

const ManageSidebarGroup = () => {
	return (
		<SidebarGroup className="p-0">
			<SidebarGroupLabel>Manage</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{sidebarMenu.map((item) => (
						<CollapsibleSidebarMenu key={item.title} item={item} />
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
};

export { ManageSidebarGroup };
