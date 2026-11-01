import type { BlockId } from "@orcai/core";
import {
	assetIdSchema,
	blockFieldsSchema,
	defaultDatabaseBlockConfig,
	publicationStatusSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
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

export const createRepositoryInputSchema = z.strictObject({
	name: z.string().min(1).describe("The repository's name, a few words."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe("Short plain-text description, up to 500 characters."),
	status: publicationStatusSchema
		.optional()
		.describe("ready: Published, so bots can use it. Defaults to draft."),
	assetIds: z
		.array(assetIdSchema)
		.optional()
		.describe(
			"Ids of the Library assets the repository holds, from findAssets with keptIn library.",
		),
});

export const createRepositoryTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new repository with the default retrieval settings, optionally holding Library assets. To change an existing one, use updateRepository.",
		inputSchema: createRepositoryInputSchema,
		run: (input, { toolCallId }) =>
			createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: callProcedure(deps, (procedures, options) =>
						procedures.block.create(
							{
								type: "database",
								name: input.name,
								description:
									input.description === undefined
										? null
										: blockDescription(input.description),
								contentJson: null,
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
						callProcedure(deps, (procedures, options) =>
							procedures.block.find(
								{
									id: repositoryId as BlockId,
								},
								options,
							),
						).pipe(Effect.map(repositoryOutline)),
				},
			),
	});
