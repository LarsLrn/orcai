import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import textColorLogo from "@/static/branding/text_color.svg";
import textWhiteLogo from "@/static/branding/text_white.svg";
import { siteConfig } from "./site-config";

/** The colour wordmark on light surfaces, the white one in dark mode. */
function Wordmark() {
	return (
		<>
			<img
				src={textColorLogo}
				alt={siteConfig.name}
				width={150}
				height={40}
				className="h-8 w-auto dark:hidden"
			/>
			<img
				src={textWhiteLogo}
				alt={siteConfig.name}
				width={150}
				height={40}
				className="hidden h-8 w-auto dark:block"
			/>
		</>
	);
}

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: <Wordmark />,
		},
		githubUrl: siteConfig.repository.url,
	};
}
