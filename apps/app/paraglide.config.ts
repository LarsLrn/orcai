import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideOptions = {
	project: "./project.inlang",
	outdir: "./src/paraglide",
	outputStructure: "message-modules",
	cookieName: "PARAGLIDE_LOCALE",
	strategy: [
		"cookie",
		"preferredLanguage",
		"baseLocale",
	],
} satisfies CompilerOptions;
