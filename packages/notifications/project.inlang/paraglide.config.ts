import { defineConfig } from "@inlang/paraglide-js";

// Templates pass the locale explicitly, so the runtime never resolves one.
export default defineConfig({
	outdir: "./src/paraglide",
	strategy: [
		"baseLocale",
	],
	emitPrettierIgnore: false,
	emitReadme: false,
});
