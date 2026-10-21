import { botIdSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { botProcedures } from "@/lib/orpc/router/bot";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, assistantTool } from "../procedure-tool";

export const deleteBotInputSchema = z.object({
	ids: z
		.array(botIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the bots to delete, from findBots or getBot."),
});

export const deleteBotTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Delete bots for good, with their chats' link to them. The user confirms before it runs. Skips bots the user may not delete.",
		inputSchema: deleteBotInputSchema,
		execute: ({ ids }, { abortSignal }) =>
			runAssistantTool(
				deleteNamed(deps, ids, {
					type: "bot",
					find: (id, options) =>
						botProcedures.find(
							{
								id,
							},
							options,
						),
					name: ({ data }) => data.name,
					canDelete: ({ data }) => data.capabilities.delete === true,
					verify: "findBots",
					remove: (ids, options) =>
						botProcedures.delete(
							{
								refs: ids.map((id) => ({
									id,
								})),
							},
							options,
						),
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: {
				deleted: output.deleted,
				skipped: output.skipped,
				...(output.skipped.length > 0
					? {
							note: "Skipped bots do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
