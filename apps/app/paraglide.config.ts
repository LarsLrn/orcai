import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideOptions = {
	project: "./project.inlang",
	outdir: "./src/paraglide",
	outputStructure: "message-modules",
	cookieName: "PARAGLIDE_LOCALE",
	strategy: [
		"url",
		"cookie",
		"preferredLanguage",
		"baseLocale",
	],
	routeStrategies: [
		{
			match: "/api/:path(.*)?",
			exclude: true,
		},
	],
	urlPatterns: [
		{
			pattern: "/:path(.*)?",
			localized: [
				[
					"en",
					"/en/:path(.*)?",
				],
				[
					"de",
					"/de/:path(.*)?",
				],
			],
		},
	],
} satisfies CompilerOptions;
