import { assetIdSchema, blockIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const prepareAssetAgainInputSchema = z.strictObject({
	assetId: assetIdSchema.describe("Id of the asset, from findAssets."),
	repositoryId: blockIdSchema
		.optional()
		.describe(
			"Give the repository to retry the document there; leave out to process the file again.",
		),
});

export const prepareAssetAgainTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Retry an asset. Without a repository, process the uploaded file again. With a repository, retry the document there: its processing when the file failed, otherwise its indexing in that repository. A document still being prepared has nothing to retry.",
		inputSchema: prepareAssetAgainInputSchema,
		run: ({ assetId, repositoryId }) =>
			(repositoryId
				? callProcedure(deps, (procedures, options) =>
						procedures.block.retryDocument(
							{
								assetId,
								blockId: repositoryId,
							},
							options,
						),
					).pipe(Effect.map(({ retried }) => retried))
				: callProcedure(deps, (procedures, options) =>
						procedures.asset.reprocess(
							{
								id: assetId,
							},
							options,
						),
					).pipe(Effect.as("processing" as const))
			).pipe(
				mutation("findAssets"),
				expectType("asset", assetId),
				expectType("repository", repositoryId ?? []),
				Effect.map((retried) => ({
					type: "asset" as const,
					id: assetId,
					repositoryId,
					retried,
				})),
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: {
				...output,
				note: output.repositoryId
					? "The document is queued; getBlock on the repository shows its state once it has run."
					: "The file is queued for processing; findAssets shows its status once it has run.",
			},
		}),
	});
