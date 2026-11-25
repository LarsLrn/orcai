import { defineConfig } from "@inlang/paraglide-js";

export default defineConfig({
	outdir: "./src/paraglide",
	outputStructure: "message-modules",
	emitTsDeclarations: true,
	cookieName: "PARAGLIDE_LOCALE",
	cookieSameSite: "lax",
	cookieSecure: "auto",
	strategy: [
		"cookie",
		"preferredLanguage",
		"baseLocale",
	],
});
