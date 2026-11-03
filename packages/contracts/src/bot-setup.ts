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

const tagged = base.meta(
	openapi({
		tags: [
			"Bots",
		],
	}),
);

export const botSetupContracts = {
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{botId}/setup",
				summary: "Find a bot's setup in the active organisation",
			}),
		)
		.input(findBotSetupInputSchema)
		.output(findBotSetupResponseSchema),
	save: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/bots/{botId}/setup",
				summary: "Save or remove a bot's setup in the active organisation",
			}),
		)
		.input(saveBotSetupInputSchema)
		.output(saveBotSetupResponseSchema),
	coverage: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{botId}/setup/coverage",
				summary:
					"Which principals the bot is shared with have a quota pool for a model",
			}),
		)
		.input(botSetupCoverageInputSchema)
		.output(botSetupCoverageResponseSchema),
};
