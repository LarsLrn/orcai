import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import { updateAssetInputSchema } from "./update-asset.declaration";

export const updateAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Change an asset's title or metadata. Only the given metadata fields change. To add new assets, use requestUpload.",
		inputSchema: updateAssetInputSchema,
		run: ({ id, title, metadata }) =>
			Effect.gen(function* () {
				yield* callProcedure(deps, (procedures, options) =>
					procedures.asset.find(
						{
							id,
						},
						options,
					),
				).pipe(expectType("asset", id));

				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.asset.save(
						{
							id,
							title,
							metadata,
						},
						options,
					),
				).pipe(mutation("findAssets"));

				return {
					type: "asset" as const,
					id: data.id,
					title: data.title,
					metadata: data.metadata,
				};
			}),
	});
