import {
	botSetupCoverageInputSchema,
	botSetupCoverageResponseSchema,
	findBotSetupInputSchema,
	findBotSetupResponseSchema,
	saveBotSetupInputSchema,
	saveBotSetupResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const botSetupContracts = {
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{botId}/setup",
				summary: "Find a bot's setup in the active organisation",
				tags: [
					"Bots",
				],
			}),
		)
		.input(findBotSetupInputSchema)
		.output(findBotSetupResponseSchema),
	save: base
		.meta(
			openapi({
				method: "PUT",
				path: "/bots/{botId}/setup",
				summary: "Save or remove a bot's setup in the active organisation",
				tags: [
					"Bots",
				],
			}),
		)
		.input(saveBotSetupInputSchema)
		.output(saveBotSetupResponseSchema),
	coverage: base
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{botId}/setup/coverage",
				summary:
					"Which principals the bot is shared with have a quota pool for a model",
				tags: [
					"Bots",
				],
			}),
		)
		.input(botSetupCoverageInputSchema)
		.output(botSetupCoverageResponseSchema),
};
