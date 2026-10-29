import { botIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { setupInputSchema, writeSetup } from "../bots/setup-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const updateBotSetupInputSchema = z.strictObject({
	id: botIdSchema.describe("Id of the bot, from findBots or getBot."),
	setup: setupInputSchema.describe(
		"The bot's model in the active organisation; null removes it so chats pick freely.",
	),
});

export const updateBotSetupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Set or remove a bot's model in the active organisation, with how many of its audience a quota pool covers. Works for bots added from the catalogue, whose definition only their home organisation changes; for the user's own bots updateBot does the same with other changes.",
		inputSchema: updateBotSetupInputSchema,
		run: ({ id, setup }) =>
			Effect.gen(function* () {
				const { data: bot } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.bot.find(
							{
								id,
							},
							options,
						),
				);
				return {
					id,
					name: bot.name,
					...(yield* writeSetup(deps, id, setup)),
				};
			}),
	});
