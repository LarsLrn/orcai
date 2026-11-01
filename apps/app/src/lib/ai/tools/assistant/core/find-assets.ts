import { assetOriginSchema, blockIdSchema } from "@orcai/schema";
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
	origin: assetOriginSchema
		.optional()
		.describe(
			"library for Library assets only, the ones a repository accepts. chat for chat uploads only. Leave out for both.",
		),
	limit: listLimitSchema,
});

export const findAssetsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find assets (uploaded documents) by title among those the user can read, optionally only those attached to one repository. Without a query it lists them all, newest first. Origin chat marks a chat upload: it stays out of repositories until someone adds it to the Library.",
		inputSchema: findAssetsInputSchema,
		run: ({ query, repositoryId, origin, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.asset.list(
					{
						pageSize: limit,
						filters: {
							search: query,
							repositoryId,
							origin,
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
						origin: asset.origin,
						canEdit: asset.capabilities.edit === true,
					})),
					total: rowCount,
				})),
			),
	});
