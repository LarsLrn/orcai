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
	],
});
