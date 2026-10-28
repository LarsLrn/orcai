import { assetIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";

const generateAssetMetadataInputSchema = z.strictObject({
	assetIds: z
		.array(assetIdSchema)
		.min(1)
		.max(100)
		.describe("Ids of the assets, from findAssets."),
});

export const generateAssetMetadataTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Generate metadata (title, source type, bibliographic fields, citation, description, language) for library assets with the organisation's utility model, in the background. Only assets whose metadata was never generated or failed are queued. Only empty fields are filled, and the title only while it is still the uploaded file's name; nothing else is overwritten. To replace values, point the user to Generate with AI in the asset's metadata editor, or use updateAsset with the values the user gives.",
		inputSchema: generateAssetMetadataInputSchema,
		run: (input) => {
			const assetIds = [
				...new Set(input.assetIds),
			];
			return callProcedure(deps, (procedures, options) =>
				procedures.asset.generateMissingMetadata(
					{
						ids: assetIds,
					},
					options,
				),
			).pipe(
				mutation("findAssets"),
				Effect.map(({ count }) => ({
					queued: count,
					skipped: assetIds.length - count,
				})),
			);
		},
		toModelOutput: ({ output }) => ({
			type: "json",
			value: {
				...output,
				note: [
					"Queued assets get their metadata in the background; findAssets shows it once it has run.",
					...(output.skipped > 0
						? [
								"Skipped assets already have generated metadata or are being generated, are not prepared library assets of this organisation, the user may not edit them, or the organisation has no utility model.",
							]
						: []),
				].join(" "),
			},
		}),
	});
