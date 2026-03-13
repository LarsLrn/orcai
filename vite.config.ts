import path from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 3000,
	},
	ssr: {
		noExternal: [
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
				__dirname,
				"./src/mocks/next-navigation.ts",
			),
		},
	},
	plugins: [
		devtools(), // must be first plugin
		paraglideVitePlugin({
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
			urlPatterns: [
				{
					pattern: "/:path(.*)?",
					localized: [
						[
							"en",
							"/:path(.*)?",
						],
						[
							"de",
							"/de/:path(.*)?",
						],
					],
				},
			],
		}),
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
