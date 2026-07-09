import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	preview: {
		host: "127.0.0.1",
	},
	server: {
		port: 3001,
	},
	plugins: [
		mdx(),
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
			},
		}),
		react(),
		nitro({
			preset: "bun",
		}),
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			tslib: "tslib/tslib.es6.js",
		},
	},
});
