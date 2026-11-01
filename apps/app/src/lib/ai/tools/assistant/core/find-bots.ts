import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { listLimitSchema, listQuerySchema } from "./list-input";

const findBotsInputSchema = z.strictObject({
	query: listQuerySchema,
	limit: listLimitSchema,
});

const toFoundBot = (bot: {
	id: string;
	name: string;
	description: string;
	status: "draft" | "ready";
	isFavourite: boolean;
	capabilities: Record<string, boolean>;
}) => ({
	id: bot.id,
	name: bot.name,
	description: bot.description,
	status: bot.status,
	canEdit: bot.capabilities.edit === true,
	favourite: bot.isFavourite,
});

export const findBotsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find bots by name: published bots the user can use and drafts they can edit. Without a query it lists them all. `favourite` marks the published bots the user made a favourite.",
		inputSchema: findBotsInputSchema,
		run: ({ query, limit }) =>
			Effect.gen(function* () {
				const bots = yield* callProcedure(deps, (procedures, options) =>
					procedures.bot.list(
						{
							pageSize: limit,
							search: query,
							filters: {
								status: "all",
							},
						},
						options,
					),
				);

				return {
					bots: bots.data.map(toFoundBot),
					total: bots.rowCount,
				};
			}),
	});
