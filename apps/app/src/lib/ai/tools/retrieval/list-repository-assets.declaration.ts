import { blockIdSchema } from "@orcai/schema";
import { LibraryIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listRepositoryAssetsTool } from "./list-repository-assets";

export const listRepositoryAssetsInputSchema = z.strictObject({
	query: z
		.string()
		.optional()
		.describe("Words from an asset's title, to narrow the list."),
	blockId: blockIdSchema
		.optional()
		.describe(
			"Id of the one repository to list. Leave it out to list all of them.",
		),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100)
		.default(30)
		.describe("The most assets to return."),
});

export const listRepositoryAssets = declareTool<
	typeof listRepositoryAssetsTool
>()({
	kind: "read",
	inputSchema: listRepositoryAssetsInputSchema,
	icon: LibraryIcon,
	name: m.chat_work_log_tool_list_repository_assets_name,
	active: m.chat_work_log_tool_list_repository_assets_active,
});
