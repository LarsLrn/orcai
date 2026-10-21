import { blockIdSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { blockProcedures } from "@/lib/orpc/router/block";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

export const deleteBlockInputSchema = z.object({
	ids: z
		.array(blockIdSchema)
		.min(1)
		.max(20)
		.describe(
			"Ids of the behaviour blocks or repositories to delete, from findBlocks or getBot.",
		),
});

export const deleteBlockTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete behaviour blocks or repositories for good; bots using them lose the link, the assets in a repository stay. Skips blocks the user may not delete.",
		inputSchema: deleteBlockInputSchema,
		run: ({ ids }) =>
			deleteNamed(deps, ids, {
				type: "block",
				find: (id, options) =>
					blockProcedures.find(
						{
							id,
						},
						options,
					),
				typeOf: ({ data }) =>
					data.type === "template" ? "template" : "repository",
				name: ({ data }) => data.name,
				canDelete: ({ data }) => data.capabilities.delete === true,
				verify: "findBlocks",
				remove: (ids, options) =>
					blockProcedures.delete(
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
							note: "Skipped blocks do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
