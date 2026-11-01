import {
	assetIdSchema,
	blockFieldsSchema,
	blockIdSchema,
	publicationStatusSchema,
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
import {
	blockDescription,
	repositoryOutline,
	uniqueAssetIds,
	wrongBlockError,
} from "./block-outline";

const updateRepositoryInputSchema = z.strictObject({
	id: blockIdSchema.describe("Id of the repository to update."),
	name: z
		.string()
		.min(1)
		.optional()
		.describe("Leave out to keep the current name."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe(
			"Short plain-text description, up to 500 characters. Leave out to keep the current one.",
		),
	status: publicationStatusSchema
		.optional()
		.describe(
			"ready: Published, so bots can use it. Leave out to keep the current status.",
		),
	assetIds: z
		.array(assetIdSchema)
		.optional()
		.describe(
			"Ids of every Library asset the repository holds, from findAssets with keptIn library; replaces the current set, [] empties it. Assets taken out stay in the Library. Leave out to keep the current assets.",
		),
});

export const updateRepositoryTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Update an existing repository: name, description, status and which assets it holds. Give only the fields that change. Everything else, including the retrieval settings and rich content, is kept. To add or remove one asset, read the current ones with findAssets (repositoryId) and send the full new assetIds. To create one, use createRepository.",
		inputSchema: updateRepositoryInputSchema,
		run: (input) =>
			Effect.gen(function* () {
				const { id } = input;
				const { data: current, assets: currentAssets = [] } =
					yield* callProcedure(deps, (procedures, options) =>
						procedures.block.find(
							{
								id,
							},
							options,
						),
					).pipe(expectType("repository", id));

				if (current.type !== "repository") {
					return yield* Effect.fail(
						wrongBlockError("repository", id, current.type),
					);
				}

				const saved = yield* callProcedure(deps, (procedures, options) =>
					procedures.block.update(
						{
							id,
							type: "repository",
							name: input.name ?? current.name,
							description:
								input.description === undefined
									? current.description
									: blockDescription(input.description),
							contentJson: current.contentJson,
							status: input.status ?? current.status,
							config: current.config,
							assets: uniqueAssetIds(
								input.assetIds ?? currentAssets.map((asset) => asset.id),
							),
						},
						options,
					),
				).pipe(mutation("getBlock"), expectType("asset", input.assetIds ?? []));

				return repositoryOutline(saved);
			}),
	});
