import { compile } from "@inlang/paraglide-js";

// Templates pass the locale explicitly, so the runtime never resolves one.
await compile({
	project: "./project.inlang",
	outdir: "./src/paraglide",
	outputStructure: "locale-modules",
	strategy: [
		"baseLocale",
	],
	emitPrettierIgnore: false,
	emitReadme: false,
});
