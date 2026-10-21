import type { BlockId } from "@orcai/core";
import { blockIdSchema } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const getBlockInputSchema = z.object({
	id: blockIdSchema.describe(
		"Id of the AI behaviour (template) or repository, from findBlocks or getBot.",
	),
});

/** Document states and totals of one repository. */
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
			"Read one AI behaviour (template) or repository by id: name, description, status and what the user may do with it. A template comes with its system prompt; a repository with its document totals and each attached asset's state there: queued, processing, indexing, ready or failed (with the failed stage and reason). Only ready documents are searchable.",
		inputSchema: getBlockInputSchema,
		run: ({ id }) =>
			Effect.gen(function* () {
				const notFound = new AssistantToolError(
					`BLOCK_NOT_FOUND: No template or repository with id ${id} that the user can read. Look ids up with findBlocks; bot ids belong to getBot.`,
				);

				const { data: block } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.block.find(
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

				const readiness = yield* readinessOf(deps, block.id);
				if (!readiness) {
					return yield* Effect.fail(notFound);
				}

				return {
					type: "repository" as const,
					...common,
					documents: readiness.totals,
					assets: readiness.documents.map((document) => ({
						id: document.assetId,
						title: document.title,
						state: document.state,
						failure: document.failure ?? undefined,
					})),
				};
			}),
	});
