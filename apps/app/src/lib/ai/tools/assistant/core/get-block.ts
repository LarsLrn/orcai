import type { AssetId, BlockId } from "@orcai/core";
import {
	blockIdSchema,
	type JobState,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import { blockProcedures } from "@/lib/orpc/router/block";
import { jobProcedures } from "@/lib/orpc/router/job";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

export const getBlockInputSchema = z.object({
	id: blockIdSchema.describe(
		"Id of the AI behaviour (template) or repository, from findBlocks or getBot.",
	),
});

const vectorisationOf = (state: JobState | undefined) => {
	switch (state) {
		case undefined:
			return "none" as const;
		case "created":
		case "retry":
			return "queued" as const;
		case "active":
			return "running" as const;
		default:
			return state;
	}
};

/** The newest vectorisation job state per asset in one repository. */
const vectorisationStates = (deps: AssistantToolDeps, repositoryId: BlockId) =>
	callProcedure(deps, (options) =>
		jobProcedures.list(
			{
				resourceType: "block",
				resourceId: repositoryId,
				jobQueue: VECTORIZE_ASSET_JOB_NAME,
			},
			options,
		),
	).pipe(
		Effect.map(({ data }) => {
			const newest = new Map<AssetId, (typeof data)[number]>();

			for (const job of data) {
				if (job.name !== VECTORIZE_ASSET_JOB_NAME) {
					continue;
				}
				const current = newest.get(job.data.assetId);
				if (!current || current.createdOn < job.createdOn) {
					newest.set(job.data.assetId, job);
				}
			}

			return new Map(
				[
					...newest,
				].map(([assetId, job]) => [
					assetId,
					job.state,
				]),
			);
		}),
	);

export const getBlockTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Read one AI behaviour (template) or repository by id: name, description, status and what the user may do with it. A template comes with its system prompt; a repository with its retrieval settings and each attached asset's processing and vectorisation status in this repository (vectorisation `none` means no indexing job on record).",
		inputSchema: getBlockInputSchema,
		run: ({ id }) =>
			Effect.gen(function* () {
				const notFound = new AssistantToolError(
					`BLOCK_NOT_FOUND: No template or repository with id ${id} that the user can read. Look ids up with findBlocks; bot ids belong to getBot.`,
				);

				const { data: block, assets = [] } = yield* callProcedure(
					deps,
					(options) =>
						blockProcedures.find(
							{
								id,
							},
							options,
						),
				).pipe(
					Effect.mapError((error) =>
						error instanceof ORPCError &&
						(error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
							? notFound
							: error,
					),
				);

				const common = {
					id: block.id,
					name: block.name,
					description: block.description,
					status: block.status,
					canEdit: block.capabilities.edit === true,
					canDelete: block.capabilities.delete === true,
					canManageAccess: block.capabilities.manage_access === true,
				};

				if (block.type === "template") {
					return {
						type: "template" as const,
						...common,
						systemPrompt: block.config.systemPrompt,
					};
				}

				if (block.type !== "database") {
					return yield* Effect.fail(notFound);
				}

				const states =
					assets.length > 0
						? yield* vectorisationStates(deps, block.id)
						: new Map<AssetId, JobState>();

				return {
					type: "repository" as const,
					...common,
					retrieval: block.config,
					assets: assets.map((asset) => ({
						type: "asset" as const,
						id: asset.id,
						title: asset.title,
						processingStatus: asset.processingStatus,
						vectorisation: vectorisationOf(states.get(asset.id)),
					})),
				};
			}),
	});
