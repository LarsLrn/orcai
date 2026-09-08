import { Link } from "@tanstack/react-router";
import { LogoText } from "@/components/app/branding/logo-text";
import { useSidebar } from "@/components/ui/sidebar";

const SidebarLogo = ({
	homeTo = "/app",
}: {
	homeTo?: "/app" | "/instance";
}) => {
	const { isMobile, closeMobileForNavigation } = useSidebar();

	return (
		<Link
			to={homeTo}
			className="flex items-center lg:justify-center"
			onClick={() => isMobile && closeMobileForNavigation()}
		>
			<LogoText />
		</Link>
	);
};

export { SidebarLogo };
