import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";
import type { sidebarMenu } from "@/settings/menus";

/** Whether `pathname` is `to` or below it, by whole segments. */
const isWithin = (pathname: string, to: string) =>
	pathname === to || pathname.startsWith(`${to}/`);

const CollapsibleSidebarMenu = ({
	item,
}: {
	item: (typeof sidebarMenu)[number];
}) => {
	const { closeMobileForNavigation } = useSidebar();
	const [userExpanded, setUserExpanded] = useState(false);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	const hasRoute = !!item.linkProps;
	const hasChildren = !!item.items?.length;

	const isChildActive =
		item.items?.some(
			(sub) => !!sub.linkProps?.to && isWithin(pathname, sub.linkProps.to),
		) ?? false;
	const isRouteActive =
		isChildActive ||
		(hasRoute && !!item.linkProps?.to && isWithin(pathname, item.linkProps.to));

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
			key={item.title()}
			open={isRouteActive || userExpanded}
			onOpenChange={setUserExpanded}
			render={
				<SidebarMenuItem>
					<SidebarMenuButton
						// An item without sub-items stays active on the pages under it.
						isActive={
							hasRoute && item.linkProps?.to
								? hasChildren
									? pathname === item.linkProps.to
									: isRouteActive
								: isChildActive
						}
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
									<span>{item.title()}</span>
								</Link>
							) : (
								<div className="flex items-center gap-2">
									<item.icon />
									<span>{item.title()}</span>
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
										<span className="sr-only">
											{m.sidebar_menu_toggle_label()}
										</span>
									</SidebarMenuAction>
								}
							/>
							<CollapsibleContent>
								<SidebarMenuSub>
									{(item.items ?? []).map((subItem) => (
										<SidebarMenuSubItem key={subItem.title()}>
											<SidebarMenuSubButton
												isActive={
													!!subItem.linkProps?.to &&
													isWithin(pathname, subItem.linkProps.to)
												}
												render={
													<Link
														{...subItem.linkProps}
														onClick={closeMobileForNavigation}
													>
														<subItem.icon />
														<span>{subItem.title()}</span>
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

export { CollapsibleSidebarMenu };
