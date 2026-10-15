import path from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { paraglideOptions } from "./paraglide.config";

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
		noExternal: [
			// Bundled with the workspace packages so the server holds one OpenTelemetry SDK.
			"@effect/opentelemetry",
			"nextstepjs",
			"motion",
			"streamdown",
		],
	},
	resolve: {
		tsconfigPaths: true,
		// Mock Next.js navigation imports that nextstepjs tries to access
		// FIXME: Check whether this was addressed upstream
		alias: {
			"next/navigation": path.resolve(
				import.meta.dirname,
				"./src/mocks/next-navigation.ts",
			),
		},
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
