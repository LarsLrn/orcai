import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { paraglideOptions } from "./paraglide.config.ts";

export default defineConfig({
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
		// Loads its native bindings relative to its own files.
		external: [
			"@kreuzberg/node",
		],
		noExternal: [
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
	],
});
