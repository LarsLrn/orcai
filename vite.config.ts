import path from "node:path";
import { paraglideVitePlugin as paraglide } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
	},
	ssr: {
		noExternal: ["nextstepjs", "motion"],
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
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart({
			react: { reactRefreshHost: "http://localhost:3000" },
			customViteReactPlugin: true,
		}),
		tailwindcss(),
		react(),
		paraglide({
			project: "./project.inlang",
			outdir: "./src/paraglide",
			outputStructure: "message-modules",
			cookieName: "PARAGLIDE_LOCALE",
			strategy: ["cookie", "preferredLanguage", "baseLocale"],
		}),
	],
});
