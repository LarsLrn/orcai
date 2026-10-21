import { assetIdSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { assetProcedures } from "@/lib/orpc/router/asset";
import { deleteNamed } from "../named-delete";
import { type AssistantToolDeps, assistantTool } from "../procedure-tool";

export const deleteAssetInputSchema = z.object({
	ids: z
		.array(assetIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the assets to delete, from findAssets."),
});

export const deleteAssetTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Delete assets for good: the file, its processed text and its place in every repository. The user confirms before it runs. Skips assets the user may not delete.",
		inputSchema: deleteAssetInputSchema,
		execute: ({ ids }, { abortSignal }) =>
			runAssistantTool(
				deleteNamed(deps, ids, {
					type: "asset",
					find: (id, options) =>
						assetProcedures.find(
							{
								id,
							},
							options,
						),
					name: ({ data }) => data.title,
					canDelete: ({ data }) => data.capabilities.delete === true,
					verify: "findAssets",
					remove: (ids, options) =>
						assetProcedures.delete(
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
							note: "Skipped assets do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
