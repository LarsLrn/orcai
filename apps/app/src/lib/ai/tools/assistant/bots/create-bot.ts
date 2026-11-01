import type { BotId } from "@orcai/core";
import {
	blockIdSchema,
	botFieldsSchema,
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
import { featuresInputSchema } from "./features-input";
import { readSetup, setupInputSchema, writeSetup } from "./setup-input";

export const createBotInputSchema = z.strictObject({
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description.describe(
		"Short plain-text description shown with the bot, up to 500 characters.",
	),
	behaviourId: blockIdSchema
		.optional()
		.describe("Id of the behaviour block (template) the bot uses."),
	repositoryIds: z
		.array(blockIdSchema)
		.optional()
		.describe("Ids of every repository the bot answers from."),
	features: featuresInputSchema
		.optional()
		.describe(
			"Every enabled feature, such as { generativeUi: {}, webSearch: { allowedDomains: [] } }.",
		),
	setup: setupInputSchema.optional(),
});

/** A new bot is a draft with empty rich content. */
export const createBotPayload = (
	input: z.infer<typeof createBotInputSchema>,
): SaveBotInput => ({
	name: input.name,
	description: input.description,
	contentJson: {},
	status: "draft",
	templateBlockId: input.behaviourId ?? null,
	databaseBlockIds: input.repositoryIds ?? [],
	features: input.features ?? {},
	listBlockIds: [],
});

export const createBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new draft bot: name and description, optionally its behaviour block, repositories, features and its model in the active organisation, with how many of its audience a quota pool covers. A setup that fails comes back as setupError next to the created bot; fix it with updateBot. To change an existing bot, use updateBot. Publish with publishBot.",
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
						Effect.flatMap((bot) =>
							input.setup === undefined
								? Effect.succeed(bot)
								: writeSetup(deps, bot.id, input.setup).pipe(
										Effect.map((setup) => ({
											...bot,
											...setup,
										})),
									),
						),
					),
					ids: (bot) => [
						bot.id,
					],
					// A replay reads the setup back, so it never undoes a change made since.
					replay: ([botId]) =>
						callProcedure(deps, (procedures, options) =>
							procedures.bot.findEditor(
								{
									id: botId as BotId,
								},
								options,
							),
						).pipe(
							Effect.map(({ data }) => botOutline(data)),
							Effect.flatMap((bot) =>
								input.setup === undefined
									? Effect.succeed(bot)
									: readSetup(deps, bot.id).pipe(
											Effect.map((setup) => ({
												...bot,
												setup,
											})),
										),
							),
						),
				},
			);
		},
	});
