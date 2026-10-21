import type { BotId } from "@orcai/core";
import {
	blockIdSchema,
	botFieldsSchema,
	featuresSchema,
	type SaveBotInput,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	createOnce,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { botOutline } from "./bot-outline";

export const createBotInputSchema = z.object({
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description.describe(
		"Short plain-text description shown with the bot, up to 500 characters.",
	),
	templateId: blockIdSchema
		.optional()
		.describe("Id of the behaviour block (template) the bot uses."),
	repositoryIds: z
		.array(blockIdSchema)
		.optional()
		.describe("Ids of every repository the bot answers from."),
	features: featuresSchema
		.optional()
		.describe("Every enabled feature, such as { generativeUi: {} }."),
});

/** A new bot is a draft with empty rich content. */
export const createBotPayload = (
	input: z.infer<typeof createBotInputSchema>,
): SaveBotInput => ({
	name: input.name,
	description: input.description,
	contentJson: {},
	contentHtml: "",
	status: "draft",
	templateBlockId: input.templateId ?? null,
	databaseBlockIds: input.repositoryIds ?? [],
	features: input.features ?? {},
});

export const createBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new draft bot: name and description, optionally its behaviour block, repositories and features. To change an existing bot, use updateBot. Publish with publishBot.",
		inputSchema: createBotInputSchema,
		run: (input, { toolCallId }) => {
			const payload = createBotPayload(input);
			const { templateBlockId, databaseBlockIds } = payload;

			return createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: callProcedure(deps, (procedures, options) =>
						procedures.bot.save(payload, options),
					).pipe(
						mutation("findBots"),
						expectType("block", [
							...(templateBlockId
								? [
										templateBlockId,
									]
								: []),
							...databaseBlockIds,
						]),
						expectType("template", templateBlockId ?? []),
						expectType("repository", databaseBlockIds),
						Effect.map(({ data }) => botOutline(data)),
					),
					ids: (bot) => [
						bot.id,
					],
					replay: ([botId]) =>
						callProcedure(deps, (procedures, options) =>
							procedures.bot.findEditor(
								{
									id: botId as BotId,
								},
								options,
							),
						).pipe(Effect.map(({ data }) => botOutline(data))),
				},
			);
		},
	});
