import {
	Link,
	type StaticDataRouteOption,
	useMatches,
} from "@tanstack/react-router";
import { ChevronDownIcon, EllipsisIcon, HomeIcon } from "lucide-react";
import { Fragment } from "react";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLinkItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LocaleSwitcher } from "./locale/locale-switcher";

const currentCrumbClassName =
	"h-7 min-w-0 max-w-full shrink overflow-hidden lg:max-w-96";

const Header = ({ homeTo = "/app" }: { homeTo?: "/app" | "/instance" }) => {
	const matches = useMatches();

	const breadcrumbItems = matches
		.filter((match) => match.meta?.find((entry) => entry?.title))
		.map(({ pathname, meta, staticData }) => ({
			href: pathname,
			label: meta?.find((entry) => entry?.title)?.title,
			titleMenu: staticData.titleMenu,
		}))
		.filter((i) => i.href !== "/" && i.href !== homeTo)
		.filter((i) => i.label !== undefined) as {
		href: string;
		label: string;
		titleMenu?: StaticDataRouteOption["titleMenu"];
	}[];
	const current = breadcrumbItems.at(-1);
	const TitleMenu = current?.titleMenu;

	return (
		<header className="sticky top-2 z-10 mx-2 flex h-12 min-w-0 shrink-0 items-center gap-2 rounded-lg border bg-sidebar px-4 text-muted-foreground shadow-sm">
			<SidebarTrigger className="-ml-1 shrink-0" variant="ghost" />
			<Separator
				orientation="vertical"
				className="my-auto mr-2 data-[orientation=vertical]:h-7"
			/>
			<div className="flex min-w-0 flex-1 items-center justify-between gap-2">
				<Breadcrumb className="min-w-0 flex-1">
					<BreadcrumbList className="min-w-0 flex-nowrap gap-0 overflow-hidden">
						<BreadcrumbItem>
							<Link
								to={homeTo}
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "icon",
										className: "size-7",
									}),
								)}
							>
								<HomeIcon className="size-4.5" aria-hidden="true" />
								<span className="sr-only">{m.header_home_link_label()}</span>
							</Link>
						</BreadcrumbItem>

						{breadcrumbItems.length > 1 && (
							<BreadcrumbItem className="lg:hidden">
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="ghost" size="icon-sm">
												<EllipsisIcon aria-hidden="true" />
												<span className="sr-only">
													{m.header_breadcrumb_menu_label()}
												</span>
											</Button>
										}
									/>
									<DropdownMenuContent positionMethod="fixed">
										<DropdownMenuGroup>
											{breadcrumbItems.slice(0, -1).map((item) => (
												<DropdownMenuLinkItem
													key={item.href}
													title={item.label}
													className="block max-w-72 truncate"
													render={<Link to={item.href} />}
												>
													{item.label}
												</DropdownMenuLinkItem>
											))}
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</BreadcrumbItem>
						)}

						{breadcrumbItems.slice(0, -1).map((item) => (
							<Fragment key={item.href}>
								<BreadcrumbSeparator className="hidden lg:block" />
								<BreadcrumbItem className="hidden min-w-0 lg:inline-flex">
									<Link
										to={item.href}
										title={item.label}
										className={cn(
											buttonVariants({
												variant: "ghost",
												size: "sm",
												className:
													"h-7 min-w-0 max-w-56 shrink overflow-hidden",
											}),
										)}
									>
										<span className="truncate">{item.label}</span>
									</Link>
								</BreadcrumbItem>
							</Fragment>
						))}

						{current && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem className="min-w-0">
									{TitleMenu ? (
										<TitleMenu>
											<Button
												variant="ghost"
												size="sm"
												title={current.label}
												className={currentCrumbClassName}
											>
												<span className="truncate">{current.label}</span>
												<ChevronDownIcon aria-hidden="true" />
											</Button>
										</TitleMenu>
									) : (
										<Link
											to={current.href}
											aria-current="page"
											title={current.label}
											className={buttonVariants({
												variant: "ghost",
												size: "sm",
												className: currentCrumbClassName,
											})}
										>
											<span className="truncate">{current.label}</span>
										</Link>
									)}
								</BreadcrumbItem>
							</>
						)}
					</BreadcrumbList>
				</Breadcrumb>
				<div className="flex shrink-0 gap-2">
					<ThemeSwitcher className="size-8 px-0" />
					<LocaleSwitcher />
				</div>
			</div>
		</header>
	);
};

export { Header };
