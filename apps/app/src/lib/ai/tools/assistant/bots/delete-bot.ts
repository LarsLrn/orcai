import { botIdSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

const deleteBotInputSchema = z.strictObject({
	ids: z
		.array(botIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the bots to delete, from findBots or getBot."),
});

export const deleteBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete bots for good, with their chats' link to them. Skips bots the user may not delete.",
		inputSchema: deleteBotInputSchema,
		run: ({ ids }) =>
			deleteNamed(deps, ids, {
				type: "bot",
				find: (id, procedures, options) =>
					procedures.bot.find(
						{
							id,
						},
						options,
					),
				name: ({ data }) => data.name,
				canDelete: ({ data }) => data.capabilities.delete === true,
				verify: "findBots",
				remove: (ids, procedures, options) =>
					procedures.bot.delete(
						{
							refs: ids.map((id) => ({
								id,
							})),
						},
						options,
					),
			}),
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
