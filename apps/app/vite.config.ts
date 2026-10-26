import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { paraglideOptions } from "./paraglide.config.ts";

export default defineConfig(({ command }) => ({
	server: {
		port: Number(process.env.PORT ?? 3000),
		strictPort: true,
		// Dev servers are reached through per-worktree proxy hostnames.
		allowedHosts: true,
		// Devtools already pipes browser console output; forwarding it twice loops.
		forwardConsole: {
			unhandledErrors: true,
			logLevels: [],
		},
	},
	ssr: {
		external: [
			// Loads its native bindings relative to its own files.
			"@kreuzberg/node",
			// Imports its WebAssembly as a module, which Nitro's build handles.
			"shiki",
			// Bun serves its built-in module; bundling would ship the npm copy unused.
			"undici",
		],
		// The build bundles every dependency, so the server output resolves
		// nothing from node_modules at runtime.
		noExternal:
			command === "build"
				? true
				: [
						// Bundled with the workspace packages so the server holds one OpenTelemetry SDK.
						"@effect/opentelemetry",
						"motion",
						"streamdown",
					],
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		devtools(), // must be first plugin
		paraglideVitePlugin(paraglideOptions),
		tailwindcss(),
		tanstackStart({
			importProtection: {
				behavior: "error",
				client: {
					specifiers: [
						"**/effect/**",
					],
				},
			},
		}),
		react(),
		babel({
			presets: [
				reactCompilerPreset(),
			],
		}),
		// Builds the production server; development keeps the Start dev server.
		command === "build" &&
			nitro({
				preset: "bun",
				compressPublicAssets: true,
				// Bun provides undici, as in `ssr.external`.
				unenv: {
					external: [
						"undici",
					],
				},
				// Copied whole: its loader requires files the tracer cannot see.
				traceDeps: [
					"@kreuzberg/node*",
				],
			}),
	],
}));
