import { assetKeptInSchema, blockIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const findAssetsInputSchema = z.strictObject({
	query: listQuerySchema.describe(
		"Part of the title to search for, case-insensitive.",
	),
	repositoryId: blockIdSchema
		.optional()
		.describe("Only assets attached to this repository, from findBlocks."),
	keptIn: assetKeptInSchema
		.optional()
		.describe(
			"library: Library assets only, the ones a repository accepts. chat: chat uploads only. Leave out for both.",
		),
	limit: listLimitSchema,
});

export const findAssetsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find assets by title among those the user can read, optionally only those in one repository. Without a query it lists them all, newest first. Each comes with its preparation state (processingStatus) and where it is kept (keptIn). An asset with keptIn chat is a chat upload, which stays out of repositories until someone adds it to the Library.",
		inputSchema: findAssetsInputSchema,
		run: ({ query, repositoryId, keptIn, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.asset.list(
					{
						pageSize: limit,
						filters: {
							search: query,
							repositoryId,
							keptIn,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					assets: data.map((asset) => ({
						id: asset.id,
						title: asset.title,
						processingStatus: asset.processingStatus,
						keptIn: asset.keptIn,
						canEdit: asset.capabilities.edit === true,
					})),
					total: rowCount,
				})),
			),
	});
