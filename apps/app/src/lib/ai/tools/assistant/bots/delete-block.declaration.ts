import { blockIdSchema } from "@orcai/schema";
import { Trash2Icon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { deleteBlockTool } from "./delete-block";

export const deleteBlockInputSchema = z.strictObject({
	ids: z
		.array(blockIdSchema)
		.min(1)
		.max(20)
		.describe(
			"Ids of the behaviours or repositories to delete, from findBlocks or getBot.",
		),
});

export const deleteBlock = declareTool<typeof deleteBlockTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	confirm: "delete",
	inputSchema: deleteBlockInputSchema,
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_block_name(),
	active: () => m.assistant_tool_delete_block_active(),
	...batchSummary<typeof deleteBlockTool>({
		kind: "block",
		ids: (input) => input?.ids,
		named: (output) => [
			...output.deleted,
			...output.skipped,
		],
		summary: m.assistant_tool_delete_block_summary,
	}),
});
