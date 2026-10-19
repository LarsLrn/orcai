import { Link } from "@tanstack/react-router";
import { LogoText } from "@/components/app/branding/logo-text";
import { useSidebar } from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";

const SidebarLogo = ({
	homeTo = "/app",
}: {
	homeTo?: "/app" | "/instance";
}) => {
	const { isMobile, closeMobileForNavigation } = useSidebar();

	return (
		<Link
			to={homeTo}
			aria-label={m.sidebar_logo_home_link_label()}
			className="flex items-center lg:justify-center"
			onClick={() => isMobile && closeMobileForNavigation()}
		>
			<LogoText />
		</Link>
	);
};

export { SidebarLogo };
