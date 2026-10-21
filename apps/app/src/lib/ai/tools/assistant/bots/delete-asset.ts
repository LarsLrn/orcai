import { assetIdSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, effectTool } from "../procedure-tool";

const deleteAssetInputSchema = z.object({
	ids: z
		.array(assetIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the assets to delete, from findAssets."),
});

export const deleteAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete assets for good: the file, its processed text and its place in every repository. Skips assets the user may not delete.",
		inputSchema: deleteAssetInputSchema,
		run: ({ ids }) =>
			deleteNamed(deps, ids, {
				type: "asset",
				find: (id, procedures, options) =>
					procedures.asset.find(
						{
							id,
						},
						options,
					),
				name: ({ data }) => data.title,
				canDelete: ({ data }) => data.capabilities.delete === true,
				verify: "findAssets",
				remove: (ids, procedures, options) =>
					procedures.asset.delete(
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
							note: "Skipped assets do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
