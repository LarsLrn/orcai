import { botIdSchema } from "@orcai/schema";
import { Trash2Icon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { deleteBotTool } from "./delete-bot";

export const deleteBotInputSchema = z.strictObject({
	ids: z
		.array(botIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the bots to delete, from findBots or getBot."),
});

export const deleteBot = declareTool<typeof deleteBotTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	confirm: "delete",
	inputSchema: deleteBotInputSchema,
	icon: Trash2Icon,
	name: () => m.assistant_tool_delete_bot_name(),
	active: () => m.assistant_tool_delete_bot_active(),
	...batchSummary<typeof deleteBotTool>({
		kind: "bot",
		ids: (input) => input?.ids,
		named: (output) => [
			...output.deleted,
			...output.skipped,
		],
		summary: m.assistant_tool_delete_bot_summary,
	}),
});
