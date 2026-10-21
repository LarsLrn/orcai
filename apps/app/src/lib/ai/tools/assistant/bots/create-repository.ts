import type { BlockId } from "@orcai/core";
import {
	assetIdSchema,
	blockFieldsSchema,
	defaultDatabaseBlockConfig,
	publicationStatusSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { blockProcedures } from "@/lib/orpc/router/block";
import {
	type AssistantToolDeps,
	callProcedure,
	createOnce,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import {
	blockDescription,
	repositoryOutline,
	uniqueAssetIds,
} from "./block-outline";

export const createRepositoryInputSchema = z.object({
	name: z.string().min(1),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe("Short plain-text description, up to 500 characters."),
	status: publicationStatusSchema
		.optional()
		.describe("ready makes it available to bots. Defaults to draft."),
	assetIds: z
		.array(assetIdSchema)
		.optional()
		.describe("Ids of the assets the repository holds, from findAssets."),
});

export const createRepositoryTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new repository (database block) with the default retrieval settings, optionally holding assets. To change an existing one, use updateRepository.",
		inputSchema: createRepositoryInputSchema,
		run: (input, { toolCallId }) =>
			createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: callProcedure(deps, (options) =>
						blockProcedures.create(
							{
								type: "database",
								name: input.name,
								description:
									input.description === undefined
										? null
										: blockDescription(input.description),
								contentJson: null,
								contentHtml: null,
								status: input.status ?? "draft",
								config: {
									...defaultDatabaseBlockConfig,
								},
								assets: uniqueAssetIds(input.assetIds ?? []),
							},
							options,
						),
					).pipe(
						mutation("findBlocks"),
						expectType("asset", input.assetIds ?? []),
						Effect.map(repositoryOutline),
					),
					ids: (repository) => [
						repository.id,
					],
					replay: ([repositoryId]) =>
						callProcedure(deps, (options) =>
							blockProcedures.find(
								{
									id: repositoryId as BlockId,
								},
								options,
							),
						).pipe(Effect.map(repositoryOutline)),
				},
			),
	});
