import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

// Nitro's dev server hands `.md` requests to Vite as assets; marking docs pages
// as documents lets them reach the `/docs/{$}.md` route, as in production.
const docsMarkdownInDev = (): Plugin => ({
	name: "orcai:docs-markdown-in-dev",
	apply: "serve",
	enforce: "pre",
	configureServer(server) {
		server.middlewares.use((req, _res, next) => {
			if (/^\/docs(\/[^?#]*)?\.md(\?|#|$)/.test(req.url ?? "")) {
				req.headers["sec-fetch-dest"] = "document";
			}
			next();
		});
	},
});

export default defineConfig({
	preview: {
		host: "127.0.0.1",
		// Prerendering must not require the docs site's port 3001.
		strictPort: false,
	},
	server: {
		port: Number(process.env.PORT ?? 3001),
		strictPort: true,
		allowedHosts: true,
	},
	plugins: [
		docsMarkdownInDev(),
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
