import path from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
	},
	ssr: {
		noExternal: ["nextstepjs", "motion", "streamdown"],
	},
	resolve: {
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
		nitro({
			compatibilityDate: "2026-01-15",
		}),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/paraglide",
			outputStructure: "message-modules",
			cookieName: "PARAGLIDE_LOCALE",
			strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
			urlPatterns: [
				{
					pattern: "/:path(.*)?",
					localized: [
						["en", "/:path(.*)?"],
						["de", "/de/:path(.*)?"],
					],
				},
			],
		}),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
});
