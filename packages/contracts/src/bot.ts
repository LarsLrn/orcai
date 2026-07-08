import {
	deleteBotsInputSchema,
	deleteBotsResponseSchema,
	findBotEditorInputSchema,
	findBotEditorResponseSchema,
	findBotInputSchema,
	findBotResponseSchema,
	listBotsInputSchema,
	listBotsResponseSchema,
	listDraftBotsInputSchema,
	listDraftBotsResponseSchema,
	publishBotInputSchema,
	publishBotResponseSchema,
	saveBotInputSchema,
	saveBotResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const botContracts = {
	list: base
		.meta(
			openapi({
				method: "POST",
				path: "/bots",
				summary: "List all bots",
				tags: [
					"Bots",
				],
			}),
		)
		.input(listBotsInputSchema)
		.output(listBotsResponseSchema),
	listDrafts: base
		.meta(
			openapi({
				method: "POST",
				path: "/bots/drafts",
				summary: "List draft bots",
				tags: [
					"Bots",
				],
			}),
		)
		.input(listDraftBotsInputSchema)
		.output(listDraftBotsResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{id}",
				summary: "Find a bot",
				tags: [
					"Bots",
				],
			}),
		)
		.input(findBotInputSchema)
		.output(findBotResponseSchema),
	findEditor: base
		.meta(
			openapi({
				method: "GET",
				path: "/bots/{id}/editor",
				summary: "Find an editable bot authoring graph",
				tags: [
					"Bots",
				],
			}),
		)
		.input(findBotEditorInputSchema)
		.output(findBotEditorResponseSchema),
	save: base
		.meta(
			openapi({
				method: "PUT",
				path: "/bots/save",
				summary: "Create or update a bot authoring graph",
				tags: [
					"Bots",
				],
			}),
		)
		.input(saveBotInputSchema)
		.output(saveBotResponseSchema),
	publish: base
		.meta(
			openapi({
				method: "POST",
				path: "/bots/{id}/publish",
				summary: "Publish a draft bot",
				tags: [
					"Bots",
				],
			}),
		)
		.input(publishBotInputSchema)
		.output(publishBotResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/bots",
				summary: "Delete a bot",
				tags: [
					"Bots",
				],
			}),
		)
		.input(deleteBotsInputSchema)
		.output(deleteBotsResponseSchema),
};
