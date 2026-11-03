import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	listPage,
	listPageSchema,
	listPaging,
	listQuerySchema,
	PAGING_NOTE,
} from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const findModelsInputSchema = z.strictObject({
	query: listQuerySchema,
	page: listPageSchema,
});

/** Only models that can serve chats: enabled provider, not deprecated, text and tool calling. */
export const findModelsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find the chat models of the active organisation by name, for a bot's setup, newest first. It lists only models that can serve chats. Pass a model's id as setup.modelId to createBot, updateBot or updateBotSetup. ${PAGING_NOTE}`,
		inputSchema: findModelsInputSchema,
		run: ({ query, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.model.list(
					{
						...listPage(page),
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
					...listPaging(page, rowCount),
				})),
			),
	});
