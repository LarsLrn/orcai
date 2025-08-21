import { Link, useMatches } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { TextEffect } from "@/components/ui/motion/text-effect";
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
		.filter((i) => i.href !== "/" && i.href !== "/app");

	return (
		<header className="flex h-16 shrink-0 items-center gap-2 px-4 text-muted-foreground">
			<SidebarTrigger className="-ml-1" variant="subtle" />
			<Separator
				orientation="vertical"
				className="mr-2 data-[orientation=vertical]:h-4"
			/>
			<div className="flex w-full items-center justify-between gap-2">
				<Breadcrumb>
					<BreadcrumbList className="gap-0">
						<BreadcrumbItem className="hidden md:block">
							<Link
								to="/app"
								className={cn(
									buttonVariants({
										variant: "subtle",
										size: "icon",
										className: "size-7",
									}),
								)}
							>
								<HomeIcon className="size-4.5" />
							</Link>
						</BreadcrumbItem>

						{breadcrumbItems.map((item) => (
							<div className="flex items-center gap-1" key={item.href}>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<Link
										to={item.href}
										className={cn(
											buttonVariants({
												variant: "subtle",
												size: "sm",
												className: "h-7",
											}),
										)}
									>
										<TextEffect per="char" preset="fade">
											{item.label as string}
										</TextEffect>
									</Link>
								</BreadcrumbItem>
							</div>
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
