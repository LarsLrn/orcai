import type { BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { wrongIdText } from "@/lib/ai/tools/entity-kind";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
} from "../procedure-tool";
import { getBlockInputSchema } from "./get-block.declaration";

/** Asset states and totals of one repository. */
const readinessOf = (deps: AssistantToolDeps, repositoryId: BlockId) =>
	callProcedure(deps, (procedures, options) =>
		procedures.block.readiness(
			{
				blockIds: [
					repositoryId,
				],
			},
			options,
		),
	).pipe(Effect.map(({ data: [readiness] }) => readiness));

export const getBlockTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Read one behaviour or repository by id: name, description, status and what the user may do with it. A behaviour comes with its system prompt. A repository comes with its asset totals and each asset's preparation state there: queued, processing, indexing, ready or failed, with the failed stage and reason. Only ready assets are searchable.",
		inputSchema: getBlockInputSchema,
		run: ({ id }) =>
			Effect.gen(function* () {
				const { data: block } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.block.find(
							{
								id,
							},
							options,
						),
				).pipe(expectType("block", id));

				const common = {
					id: block.id,
					name: block.name,
					description: block.description,
					status: block.status,
					canEdit: block.capabilities.edit === true,
					canDelete: block.capabilities.delete === true,
					canManageAccess: block.capabilities.manage_access === true,
				};

				if (block.type === "behaviour") {
					return {
						type: "behaviour" as const,
						...common,
						systemPrompt: block.config.systemPrompt,
					};
				}

				const readiness = yield* readinessOf(deps, block.id);
				if (!readiness) {
					return yield* Effect.fail(
						new AssistantToolError(wrongIdText("block", id, "BLOCK_NOT_FOUND")),
					);
				}

				return {
					type: "repository" as const,
					...common,
					assetTotals: readiness.totals,
					assets: readiness.assets.map((asset) => ({
						id: asset.assetId,
						title: asset.title,
						state: asset.state,
						failure: asset.failure ?? undefined,
					})),
				};
			}),
	});
