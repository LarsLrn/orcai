import { blockIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const findAssetsInputSchema = z.object({
	query: listQuerySchema.describe(
		"Part of the title to search for, case-insensitive.",
	),
	repositoryId: blockIdSchema
		.optional()
		.describe("Only assets attached to this repository, from findBlocks."),
	limit: listLimitSchema,
});

export const findAssetsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find assets (uploaded documents) by title among those the user can read, optionally only those attached to one repository. Without a query it lists them all, newest first.",
		inputSchema: findAssetsInputSchema,
		run: ({ query, repositoryId, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.asset.list(
					{
						pageSize: limit,
						filters: {
							search: query,
							repositoryId,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					assets: data.map((asset) => ({
						type: "asset" as const,
						id: asset.id,
						title: asset.title,
						processingStatus: asset.processingStatus,
						canEdit: asset.capabilities.edit === true,
					})),
					total: rowCount,
				})),
			),
	});
