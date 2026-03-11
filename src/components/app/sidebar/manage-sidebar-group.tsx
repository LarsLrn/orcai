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
	useSidebar,
} from "@/components/ui/sidebar";
import { sidebarMenu } from "@/settings/menus";

const CollapsibleSidebarMenu = ({
	item,
}: {
	item: (typeof sidebarMenu)[number];
}) => {
	const { closeMobileForNavigation } = useSidebar();
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	return (
		<Collapsible
			key={item.title}
			open={
				pathname.startsWith(item.linkProps.to) ||
				(item.items?.some((sub) => pathname.startsWith(sub.linkProps.to)) ??
					false)
			}
			render={
				<SidebarMenuItem>
					<SidebarMenuButton
						isActive={
							item.items
								? pathname === item.linkProps.to
								: pathname.startsWith(item.linkProps.to)
						}
						render={
							<Link {...item.linkProps} onClick={closeMobileForNavigation}>
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
												isActive={pathname.startsWith(subItem.linkProps.to)}
												render={
													<Link
														{...subItem.linkProps}
														onClick={closeMobileForNavigation}
													>
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
