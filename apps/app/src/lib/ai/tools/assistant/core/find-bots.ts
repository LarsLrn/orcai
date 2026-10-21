import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { botProcedures } from "@/lib/orpc/router/bot";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

export const findBotsInputSchema = z.object({
	query: listQuerySchema,
	limit: listLimitSchema,
});

const toFoundBot = (bot: {
	id: string;
	name: string;
	description: string;
	status: "draft" | "ready";
	capabilities: Record<string, boolean>;
}) => ({
	type: "bot" as const,
	id: bot.id,
	name: bot.name,
	description: bot.description,
	status: bot.status,
	canEdit: bot.capabilities.edit === true,
});

export const findBotsTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Find bots by name: published bots the user can use and drafts they can edit. Without a query it lists them all.",
		inputSchema: findBotsInputSchema,
		execute: ({ query, limit }, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const input = {
						pageSize: limit,
						search: query,
					};
					const [ready, drafts] = yield* Effect.all(
						[
							callProcedure(deps, (options) =>
								botProcedures.list(input, options),
							),
							callProcedure(deps, (options) =>
								botProcedures.listDrafts(input, options),
							),
						],
						{
							concurrency: "unbounded",
						},
					);

					return {
						bots: [
							...ready.data,
							...drafts.data,
						]
							.slice(0, limit)
							.map(toFoundBot),
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
