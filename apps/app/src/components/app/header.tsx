import { Link, useMatches } from "@tanstack/react-router";
import { EllipsisIcon, HomeIcon } from "lucide-react";
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
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale/locale-switcher";

const Header = () => {
	const matches = useMatches();

	const breadcrumbItems = matches
		.filter((match) => match.meta?.find((m) => m?.title))
		.map(({ pathname, meta }) => ({
			href: pathname,
			label: meta?.find((m) => m?.title)?.title,
		}))
		.filter((i) => i.href !== "/" && i.href !== "/app")
		.filter((i) => i.label !== undefined) as {
		href: string;
		label: string;
	}[];

	return (
		<header className="sticky top-2 z-10 mx-2 flex h-12 shrink-0 items-center gap-2 rounded-lg border bg-sidebar px-4 text-muted-foreground shadow-sm">
			<SidebarTrigger className="-ml-1" variant="ghost" />
			<Separator
				orientation="vertical"
				className="my-auto mr-2 data-[orientation=vertical]:h-7"
			/>
			<div className="flex w-full items-center justify-between gap-2">
				<Breadcrumb className="min-w-0 flex-1">
					<BreadcrumbList className="min-w-0 flex-nowrap gap-0 overflow-hidden">
						<BreadcrumbItem>
							<Link
								to="/app"
								className={cn(
									buttonVariants({
										variant: "ghost",
										size: "icon",
										className: "size-7",
									}),
								)}
							>
								<HomeIcon className="size-4.5" />
							</Link>
						</BreadcrumbItem>

						{breadcrumbItems.length > 0 && (
							<>
								{breadcrumbItems.length > 1 && (
									<BreadcrumbItem className="md:hidden">
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button variant="ghost" size="icon-sm">
														<EllipsisIcon />
													</Button>
												}
											/>
											<DropdownMenuContent>
												<DropdownMenuGroup>
													{breadcrumbItems.slice(0, -1).map((item) => (
														<DropdownMenuItem key={item.href}>
															<Link
																to={item.href}
																title={item.label}
																className="block max-w-72 truncate"
															>
																{item.label}
															</Link>
														</DropdownMenuItem>
													))}
												</DropdownMenuGroup>
											</DropdownMenuContent>
										</DropdownMenu>
									</BreadcrumbItem>
								)}
								<BreadcrumbSeparator className="md:hidden" />
								<BreadcrumbItem className="md:hidden">
									<Link
										to={breadcrumbItems[breadcrumbItems.length - 1].href}
										aria-current="page"
										title={breadcrumbItems[breadcrumbItems.length - 1].label}
										className={cn(
											buttonVariants({
												variant: "ghost",
												size: "sm",
												className:
													"h-7 min-w-0 max-w-[calc(100vw-12rem)] shrink overflow-hidden",
											}),
										)}
									>
										<span className="truncate">
											{breadcrumbItems[breadcrumbItems.length - 1].label}
										</span>
									</Link>
								</BreadcrumbItem>
							</>
						)}

						{breadcrumbItems.map((item, index) => (
							<Fragment key={item.href}>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem className="hidden min-w-0 md:inline-flex">
									<Link
										to={item.href}
										aria-current={
											index === breadcrumbItems.length - 1 ? "page" : undefined
										}
										title={item.label}
										className={cn(
											buttonVariants({
												variant: "ghost",
												size: "sm",
												className: cn(
													"h-7 min-w-0 shrink overflow-hidden",
													index === breadcrumbItems.length - 1
														? "max-w-72 lg:max-w-96"
														: "max-w-40 lg:max-w-56",
												),
											}),
										)}
									>
										<span className="truncate">{item.label}</span>
									</Link>
								</BreadcrumbItem>
							</Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
				<div className="flex gap-2">
					<ThemeSwitcher className="size-8 px-0" />
					<LocaleSwitcher />
				</div>
			</div>
		</header>
	);
};

export { Header };
