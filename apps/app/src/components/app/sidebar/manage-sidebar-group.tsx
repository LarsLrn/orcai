import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
	const [userExpanded, setUserExpanded] = useState(false);
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	const hasRoute = !!item.linkProps;
	const hasChildren = !!item.items?.length;

	const isChildActive =
		item.items?.some((sub) => pathname.startsWith(sub.linkProps.to)) ?? false;
	const isRouteActive =
		isChildActive || (hasRoute && pathname.startsWith(item.linkProps.to));

	// Close the group automatically when the user navigates away from all its routes.
	useEffect(() => {
		if (!isRouteActive) {
			setUserExpanded(false);
		}
	}, [
		isRouteActive,
	]);

	return (
		<Collapsible
			key={item.title}
			open={isRouteActive || userExpanded}
			onOpenChange={setUserExpanded}
			render={
				<SidebarMenuItem>
					<SidebarMenuButton
						isActive={hasRoute ? pathname === item.linkProps.to : isChildActive}
						// When there's no own route, the whole button row toggles the group.
						onClick={
							!hasRoute && hasChildren
								? () => setUserExpanded((v) => !v)
								: undefined
						}
						render={
							hasRoute ? (
								<Link {...item.linkProps} onClick={closeMobileForNavigation}>
									<item.icon />
									<span>{item.title}</span>
								</Link>
							) : (
								<div className="flex items-center gap-2">
									<item.icon />
									<span>{item.title}</span>
								</div>
							)
						}
					/>

					{hasChildren ? (
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
									{item.items.map((subItem) => (
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
			<SidebarGroupLabel>Your Workspace</SidebarGroupLabel>
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
