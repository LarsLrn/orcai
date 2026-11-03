import {
	deleteBotsInputSchema,
	deleteBotsResponseSchema,
	findBotEditorInputSchema,
	findBotEditorResponseSchema,
	findBotInputSchema,
	findBotResponseSchema,
	listBotsInputSchema,
	listBotsResponseSchema,
	publishBotInputSchema,
	publishBotResponseSchema,
	saveBotInputSchema,
	saveBotResponseSchema,
	setBotFavouriteInputSchema,
	setBotFavouriteResponseSchema,
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

export const botContracts = {
	list: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/bots",
				summary: "List all bots",
			}),
		)
		.input(listBotsInputSchema)
		.output(listBotsResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{id}",
				summary: "Find a bot",
			}),
		)
		.input(findBotInputSchema)
		.output(findBotResponseSchema),
	findEditor: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{id}/editor",
				summary: "Find an editable bot authoring graph",
			}),
		)
		.input(findBotEditorInputSchema)
		.output(findBotEditorResponseSchema),
	save: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/bots/save",
				summary: "Create or update a bot authoring graph",
			}),
		)
		.input(saveBotInputSchema)
		.output(saveBotResponseSchema),
	publish: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/bots/{id}/publish",
				summary: "Publish a draft bot",
			}),
		)
		.input(publishBotInputSchema)
		.output(publishBotResponseSchema),
	setFavourite: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/bots/{id}/favourite",
				summary: "Add a bot to or remove it from the user's favourites",
			}),
		)
		.input(setBotFavouriteInputSchema)
		.output(setBotFavouriteResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/bots",
				summary: "Delete a bot",
			}),
		)
		.input(deleteBotsInputSchema)
		.output(deleteBotsResponseSchema),
};
