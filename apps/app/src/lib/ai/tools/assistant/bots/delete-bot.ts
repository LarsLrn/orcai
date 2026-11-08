import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { deleteBotInputSchema } from "./delete-bot.declaration";

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
			}).pipe(
				Effect.map(({ deleted, skipped }) => ({
					deleted,
					skipped,
				})),
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
