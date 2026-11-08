import {
	assetIdSchema,
	blockIdSchema,
	SEARCH_QUERIES_MAX,
	searchQuerySchema,
} from "@orcai/schema";
import { SearchIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { passageSources, searchOutputSchema } from "./outputs";
import type { searchRepositoriesTool } from "./search-repositories";

export const searchRepositoriesInputSchema = z.strictObject({
	query: searchQuerySchema
		.min(2)
		.optional()
		.describe(
			"What to search for, as one focused phrase or question rather than a rewritten paragraph.",
		),
	queryVariants: z
		.array(
			searchQuerySchema
				.min(2)
				.describe("Another short wording of the same search."),
		)
		.max(SEARCH_QUERIES_MAX - 1)
		.optional()
		.describe(
			"Other wordings of the same search, only for synonyms or names the query may miss.",
		),
	assetIds: z
		.array(assetIdSchema)
		.max(20)
		.optional()
		.describe(
			"Ids of the assets to search, from listRepositoryAssets. Leave it out to search every asset.",
		),
	blockId: blockIdSchema
		.optional()
		.describe(
			"Id of the one repository to search. Leave it out to search all of them.",
		),
});

export const searchRepositories = declareTool<typeof searchRepositoriesTool>()({
	kind: "read",
	inputSchema: searchRepositoriesInputSchema,
	icon: SearchIcon,
	name: m.chat_work_log_tool_search_name,
	active: m.chat_work_log_tool_search_active,
	sources: (output) =>
		passageSources(searchOutputSchema.safeParse(output).data?.results ?? []),
});
