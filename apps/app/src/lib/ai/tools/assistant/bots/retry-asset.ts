import { assetIdSchema, blockIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { jobProcedures } from "@/lib/orpc/router/job";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const retryAssetInputSchema = z.object({
	assetId: assetIdSchema.describe("Id of the asset, from findAssets."),
	repositoryId: blockIdSchema
		.optional()
		.describe(
			"Give the repository to retry vectorisation of a processed asset in it; leave out to retry processing the file.",
		),
});

export const retryAssetTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Retry a failed background job for an asset: processing the uploaded file, or vectorisation in one repository once processing has completed.",
		inputSchema: retryAssetInputSchema,
		run: ({ assetId, repositoryId }) =>
			(repositoryId
				? callProcedure(deps, (options) =>
						jobProcedures.retryVectorization(
							{
								assetId,
								blockId: repositoryId,
							},
							options,
						),
					)
				: callProcedure(deps, (options) =>
						jobProcedures.retryProcessing(
							{
								assetId,
							},
							options,
						),
					)
			).pipe(
				mutation("findAssets"),
				expectType("asset", assetId),
				expectType("repository", repositoryId ?? []),
				Effect.as({
					type: "asset" as const,
					id: assetId,
					repositoryId,
					retried: repositoryId
						? ("vectorisation" as const)
						: ("processing" as const),
				}),
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: {
				...output,
				note: "The job is queued; findAssets shows the processing status once it has run.",
			},
		}),
	});
