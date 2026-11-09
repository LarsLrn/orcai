import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { deleteAssetInputSchema } from "./delete-asset.declaration";

export const deleteAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete assets for good: the file, the text OrcAI prepared from it and its place in every repository. A published bot whose repository it leaves empty moves to Draft. Skips assets the user may not delete.",
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
							note: "Skipped assets do not exist or the user may not delete them.",
						}
					: {}),
			},
		}),
	});
