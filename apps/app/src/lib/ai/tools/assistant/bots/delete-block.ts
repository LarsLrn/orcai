import { blockIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

const deleteBlockInputSchema = z.strictObject({
	ids: z
		.array(blockIdSchema)
		.min(1)
		.max(20)
		.describe(
			"Ids of the behaviours or repositories to delete, from findBlocks or getBot.",
		),
});

export const deleteBlockTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete behaviours or repositories for good. Bots using them lose the link, and the assets in a repository stay in the Library. Skips blocks the user may not delete.",
		inputSchema: deleteBlockInputSchema,
		run: ({ ids }) =>
			deleteNamed(deps, ids, {
				type: "block",
				find: (id, procedures, options) =>
					procedures.block.find(
						{
							id,
						},
						options,
					),
				typeOf: ({ data }) => data.type,
				name: ({ data }) => data.name,
				canDelete: ({ data }) => data.capabilities.delete === true,
				verify: "findBlocks",
				remove: (ids, procedures, options) =>
					procedures.block.delete(
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
							note: "Skipped blocks do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
