import { defaultRepositoryConfig } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import {
	blockDescription,
	repositoryOutline,
	uniqueAssetIds,
} from "./block-outline";
import { createRepositoryInputSchema } from "./create-repository.declaration";

export const createRepositoryTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new repository with the default retrieval settings, optionally holding Library assets. To change an existing one, use updateRepository.",
		inputSchema: createRepositoryInputSchema,
		run: (input) =>
			callProcedure(deps, (procedures, options) =>
				procedures.block.create(
					{
						type: "repository",
						name: input.name,
						description:
							input.description === undefined
								? null
								: blockDescription(input.description),
						contentJson: null,
						status: input.status ?? "draft",
						config: {
							...defaultRepositoryConfig,
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
	});
