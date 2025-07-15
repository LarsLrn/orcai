"use client";

import { Link } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";
/* import { PageTitle } from "@/components/app/page-title"; */
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/* import LocaleSwitcher from "./locale/locale-switcher"; */

const Header = () => {
	const { isMobile, state } = useSidebar();

	return (
		<header
			className={cn(
				"fixed z-50 flex h-14 w-full items-center justify-between gap-2 border-b bg-background p-4",
				"transition-[width] duration-200 ease-linear", // Replace transition-all with specific width transition
				{
					"w-full": isMobile,
					"w-[calc(100%-var(--sidebar-width))]":
						!isMobile && state === "expanded",
				},
			)}
		>
			<div className="flex shrink-0 items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />
				{/* <PageTitle /> */}
				Some Page
			</div>
			<div className="flex gap-2">
				<Link
					to={"/app"}
					className={cn(
						buttonVariants({
							variant: "outline",
							size: "icon",
							className: "size-8",
						}),
						"size-8",
					)}
				>
					<HomeIcon />
					<span className="sr-only">Go to dashboard</span>
				</Link>
				<ThemeSwitcher className="size-8 px-0" />
				{/* <LocaleSwitcher /> */}
			</div>
		</header>
	);
};

export { Header };
