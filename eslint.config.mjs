// First-party package-specific rules only; Biome owns formatting and general linting.

import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import { defineConfig } from "eslint/config";
import pluginDrizzle from "eslint-plugin-drizzle";
import tseslint from "typescript-eslint";

const typeScriptFiles = [
	"**/*.{ts,tsx,mts,cts}",
];
const appTypeScriptFiles = [
	"apps/*/**/*.{ts,tsx,mts,cts}",
];
const workspaceTypeScriptFiles = [
	"apps/*/**/*.{ts,tsx,mts,cts}",
	"packages/*/**/*.{ts,tsx,mts,cts}",
];

export default defineConfig([
	{
		ignores: [
			"**/routeTree.gen.ts",
			"**/.tanstack/**",
			"apps/*/.source/**",
			"apps/*/src/paraglide/**",
		],
	},
	{
		files: typeScriptFiles,
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"apps/app/compile-paraglide.ts",
						"apps/app/paraglide.config.ts",
						"apps/app/vite.config.ts",
						"packages/db/drizzle.config.ts",
					],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: appTypeScriptFiles,
		plugins: {
			"@tanstack/router": pluginRouter,
		},
		rules: {
			"@tanstack/router/create-route-property-order": "error",
		},
	},
	{
		files: appTypeScriptFiles,
		plugins: {
			"@tanstack/query": pluginQuery,
		},
		rules: {
			"@tanstack/query/exhaustive-deps": "error",
			"@tanstack/query/infinite-query-property-order": "error",
			"@tanstack/query/mutation-property-order": "error",
			"@tanstack/query/no-rest-destructuring": "error",
			"@tanstack/query/no-unstable-deps": "error",
			"@tanstack/query/no-void-query-fn": "error",
			"@tanstack/query/prefer-query-options": "error",
			"@tanstack/query/stable-query-client": "error",
		},
	},
	{
		files: workspaceTypeScriptFiles,
		plugins: {
			drizzle: pluginDrizzle,
		},
		rules: {
			"drizzle/enforce-delete-with-where": [
				"error",
				{
					drizzleObjectName: [
						"db",
					],
				},
			],
			"drizzle/enforce-update-with-where": [
				"error",
				{
					drizzleObjectName: [
						"db",
					],
				},
			],
		},
	},
]);
