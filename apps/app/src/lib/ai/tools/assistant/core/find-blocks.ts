import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { blockTypeOf } from "@/lib/ai/tools/entity-kind";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const findBlocksInputSchema = z.object({
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

export const findBlocksTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find AI behaviours (templates) or repositories by name, published and drafts, among those the user can read. Without a query it lists them all, newest first.",
		inputSchema: findBlocksInputSchema,
		run: ({ type, query, limit }) =>
			Effect.gen(function* () {
				const [ready, drafts] = yield* Effect.forEach(
					[
						"ready",
						"draft",
					] as const,
					(status) =>
						callProcedure(deps, (procedures, options) =>
							procedures.block.list(
								{
									pageSize: limit,
									filters: {
										type: blockTypeOf(type),
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
	});
