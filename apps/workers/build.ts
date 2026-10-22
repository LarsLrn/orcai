import { build } from "bun";

// Bundles the workers with every dependency except the externals, which the
// image installs from this package's `dependencies`. Bundling breaks a
// package that loads native bindings (`@kreuzberg/node`), reads its own files
// through `__dirname` (baked in as the build machine's path) or
// `import.meta.url` (resolved next to the bundle), or imports a computed
// name: add such a package here and to `dependencies`.
await build({
	entrypoints: [
		"src/start-workers.ts",
	],
	outdir: "dist",
	target: "bun",
	sourcemap: "linked",
	external: [
		"@kreuzberg/node",
	],
});
