import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { siteConfig } from "./site-config";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			// JSX supported
			title: siteConfig.name,
		},
		githubUrl: siteConfig.repository.url,
	};
}
