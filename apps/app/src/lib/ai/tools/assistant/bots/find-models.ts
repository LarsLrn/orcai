import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { listLimitSchema, listQuerySchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const findModelsInputSchema = z.strictObject({
	query: listQuerySchema,
	limit: listLimitSchema,
});

/** Only models that can serve chats: enabled provider, not deprecated, text and tool calling. */
export const findModelsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find the chat models of the active organisation by name, for a bot's setup. It lists only models that can serve chats. Pass a model's id as setup.modelId to createBot, updateBot or updateBotSetup.",
		inputSchema: findModelsInputSchema,
		run: ({ query, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.model.list(
					{
						pageSize: limit,
						filters: {
							search: query,
							capabilities: [
								"text",
								"tool-calling",
							],
							isDeprecated: false,
							providerEnabled: true,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					models: data.map((model) => ({
						id: model.id,
						name: model.name,
						description: model.description,
						maxOutputTokens: model.maxOutputTokens,
					})),
					total: rowCount,
				})),
			),
	});
