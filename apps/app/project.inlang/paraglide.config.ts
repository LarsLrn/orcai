import { defineConfig } from "@inlang/paraglide-js";

export default defineConfig({
	outdir: "./src/paraglide",
	outputStructure: "message-modules",
	cookieName: "PARAGLIDE_LOCALE",
	strategy: [
		"cookie",
		"preferredLanguage",
		"baseLocale",
	],
});
