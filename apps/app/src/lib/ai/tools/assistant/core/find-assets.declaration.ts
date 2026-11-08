import { assetKeptInSchema, blockIdSchema } from "@orcai/schema";
import { SearchIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findAssetsTool } from "./find-assets";
import { listPageSchema, listQuerySchema } from "./list-input";

export const findAssetsInputSchema = z.strictObject({
	query: listQuerySchema.describe(
		"Part of the title to search for, case-insensitive.",
	),
	repositoryId: blockIdSchema
		.optional()
		.describe("Only assets attached to this repository, from findBlocks."),
	keptIn: assetKeptInSchema
		.optional()
		.describe(
			"library: Library assets only, the ones a repository accepts. chat: chat uploads only. Leave out for both.",
		),
	page: listPageSchema,
});

export const findAssets = declareTool<typeof findAssetsTool>()({
	kind: "read",
	group: "core",
	inputSchema: findAssetsInputSchema,
	icon: SearchIcon,
	name: () => m.assistant_tool_find_assets_name(),
	active: () => m.assistant_tool_find_assets_active(),
	refs: ({ input, output }) =>
		output && input?.repositoryId
			? [
					{
						kind: "repository",
						id: input.repositoryId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!output) {
			return m.assistant_tool_find_assets_name();
		}

		const count = output.total;
		const query = input?.query?.trim();
		const quotedQuery = query
			? m.assistant_tool_quoted_name({
					name: query,
				})
			: undefined;
		const repositoryId = input?.repositoryId;
		const repository = repositoryId
			? m.assistant_tool_quoted_name({
					name: nameOf({
						kind: "repository",
						id: repositoryId,
					}),
				})
			: undefined;

		if (repository) {
			return quotedQuery
				? m.assistant_tool_find_assets_summary_query_repository({
						count,
						query: quotedQuery,
						repository,
					})
				: m.assistant_tool_find_assets_summary_repository({
						count,
						repository,
					});
		}

		return quotedQuery
			? m.assistant_tool_find_assets_summary_query({
					count,
					query: quotedQuery,
				})
			: m.assistant_tool_find_assets_summary({
					count,
				});
	},
});
