"use client";

import { Link } from "@tanstack/react-router";
import { LogoText } from "@/components/app/branding/logo-text";
import { useSidebar } from "@/components/ui/sidebar";

const SidebarLogo = () => {
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<Link
			to={"/app"}
			className="flex items-center lg:justify-center"
			onClick={() => isMobile && setOpenMobile(false)}
		>
			<LogoText />
		</Link>
	);
};

export { SidebarLogo };
