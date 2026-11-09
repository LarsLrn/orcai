import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { deleteBlockInputSchema } from "./delete-block.declaration";

export const deleteBlockTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Delete behaviours or repositories for good. Bots using them lose the link, and a published bot left without a behaviour moves to Draft. The assets in a repository stay in the Library. Skips blocks the user may not delete.",
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
