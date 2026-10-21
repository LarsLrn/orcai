import {
	type AssetMetadataType,
	assetFieldsSchema,
	assetIdSchema,
	metadataSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { assetProcedures } from "@/lib/orpc/router/asset";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const assetMetadataPatchSchema = metadataSchema.partial();

export const updateAssetInputSchema = z.object({
	id: assetIdSchema.describe("Id of the asset, from findAssets."),
	title: assetFieldsSchema.shape.title
		.optional()
		.describe("Leave out to keep the current title."),
	metadata: assetMetadataPatchSchema
		.optional()
		.describe(
			"Only the metadata fields to change; the others keep their values.",
		),
});

/** Given keys win; keys left out or undefined keep their stored values. */
export const mergeAssetMetadata = (
	stored: AssetMetadataType,
	patch: z.infer<typeof assetMetadataPatchSchema> = {},
): AssetMetadataType => ({
	...stored,
	...Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	),
});

export const updateAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Change an asset's title or citation metadata. Only the given metadata fields change. Uploading new assets happens on the upload page, not here.",
		inputSchema: updateAssetInputSchema,
		run: ({ id, title, metadata }) =>
			Effect.gen(function* () {
				const { data: current } = yield* callProcedure(deps, (options) =>
					assetProcedures.find(
						{
							id,
						},
						options,
					),
				).pipe(expectType("asset", id));

				const { data } = yield* callProcedure(deps, (options) =>
					assetProcedures.save(
						{
							id,
							title: title ?? current.title,
							metadata: mergeAssetMetadata(current.metadata, metadata),
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
