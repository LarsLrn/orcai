import { assetIdSchema, blockIdSchema } from "@orcai/schema";
import { BookMarkedIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getAssetPageTool } from "./get-asset-page";
import { pageOutputSchema, passageSources } from "./outputs";

export const getAssetPageInputSchema = z.strictObject({
	page: z.coerce
		.number()
		.int()
		.min(1)
		.describe("The page number, counting from 1."),
	blockId: blockIdSchema
		.optional()
		.describe(
			"Id of the one repository to read from. Leave it out to read from all of them.",
		),
	assetId: assetIdSchema
		.optional()
		.describe("Id of the asset, from listRepositoryAssets."),
	assetTitleQuery: z
		.string()
		.optional()
		.describe("Words from the asset's title, when you do not know its id."),
	includeAdjacentPages: z.coerce
		.number()
		.int()
		.min(0)
		.max(2)
		.default(0)
		.describe("How many pages before and after the page to read as well."),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(30)
		.default(12)
		.describe("The most passages to return."),
});

export const getAssetPage = declareTool<typeof getAssetPageTool>()({
	kind: "read",
	inputSchema: getAssetPageInputSchema,
	icon: BookMarkedIcon,
	name: m.chat_work_log_tool_get_page_name,
	active: m.chat_work_log_tool_get_page_active,
	sources: (output) =>
		passageSources(pageOutputSchema.safeParse(output).data?.passages ?? []),
});
