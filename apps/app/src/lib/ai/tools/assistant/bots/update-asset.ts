import {
	assetFieldsSchema,
	assetIdSchema,
	metadataSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const assetMetadataPatchSchema = metadataSchema.partial().strict();

const updateAssetInputSchema = z.strictObject({
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

export const updateAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Change an asset's title or citation metadata. Only the given metadata fields change. Uploading new assets happens on the upload page, not here.",
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
