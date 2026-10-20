import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { blockProcedures } from "@/lib/orpc/router/block";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	runAssistantTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

export const findBlocksInputSchema = z.object({
	type: z
		.enum([
			"template",
			"repository",
		])
		.describe(
			"template: an AI behaviour (system prompt) a bot follows. repository: a collection of assets a bot answers from.",
		),
	query: listQuerySchema,
	limit: listLimitSchema,
});

const blockTypes = {
	template: "template",
	repository: "database",
} as const;

export const findBlocksTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Find AI behaviours (templates) or repositories by name, published and drafts, among those the user can read. Without a query it lists them all, newest first.",
		inputSchema: findBlocksInputSchema,
		execute: ({ type, query, limit }, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const [ready, drafts] = yield* Effect.forEach(
						[
							"ready",
							"draft",
						] as const,
						(status) =>
							callProcedure(deps, (options) =>
								blockProcedures.list(
									{
										pageSize: limit,
										filters: {
											type: blockTypes[type],
											status,
											search: query,
										},
									},
									options,
								),
							),
						{
							concurrency: "unbounded",
						},
					);

					return {
						blocks: [
							...ready.data,
							...drafts.data,
						]
							.slice(0, limit)
							.map((block) => ({
								type,
								id: block.id,
								name: block.name,
								description: block.description,
								status: block.status,
								canEdit: block.capabilities.edit === true,
							})),
						total: ready.rowCount + drafts.rowCount,
					};
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
