import type { BlockId } from "@orcai/core";
import {
	type BotEditor,
	blockIdSchema,
	botFieldsSchema,
	botIdSchema,
	featuresSchema,
	type SaveBotInput,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { botOutline } from "./bot-outline";

export const updateBotInputSchema = z.object({
	id: botIdSchema.describe("Id of the bot to update."),
	name: botFieldsSchema.shape.name
		.optional()
		.describe("Leave out to keep the current name."),
	description: botFieldsSchema.shape.description
		.optional()
		.describe(
			"Short plain-text description shown with the bot, up to 500 characters. Leave out to keep the current one.",
		),
	templateId: blockIdSchema
		.nullable()
		.optional()
		.describe(
			"Id of the behaviour block (template) the bot uses; null unlinks it. Leave out to keep the current one.",
		),
	repositoryIds: z
		.array(blockIdSchema)
		.optional()
		.describe(
			"Ids of every repository the bot answers from; replaces the current list. Leave out to keep it.",
		),
	features: featuresSchema
		.optional()
		.describe(
			"Every enabled feature, such as { generativeUi: {}, webSearch: { allowedDomains: [] } }; replaces the current set. Leave out to keep it.",
		),
});

/** The parts of the stored bot an update keeps when the model leaves them out. */
type StoredBot = Pick<
	BotEditor,
	| "id"
	| "name"
	| "description"
	| "contentJson"
	| "contentHtml"
	| "status"
	| "features"
> & {
	templateBlock: {
		id: BlockId;
	} | null;
	databaseBlocks: {
		id: BlockId;
	}[];
};

/** `bot.save` replaces the whole record, so an update sends back what it was not given. */
export const updateBotPayload = (
	input: z.infer<typeof updateBotInputSchema>,
	current: StoredBot,
): SaveBotInput => ({
	id: current.id,
	name: input.name ?? current.name,
	description: input.description ?? current.description,
	contentJson: current.contentJson,
	contentHtml: current.contentHtml,
	status: current.status,
	templateBlockId:
		input.templateId === undefined
			? (current.templateBlock?.id ?? null)
			: input.templateId,
	databaseBlockIds:
		input.repositoryIds ?? current.databaseBlocks.map((block) => block.id),
	features: input.features ?? current.features,
});

export const updateBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Update an existing bot: name, description, behaviour block, repositories and features. Give only the fields that change; everything else, including status and rich content, is kept. To create a bot, use createBot.",
		inputSchema: updateBotInputSchema,
		run: (input) =>
			Effect.gen(function* () {
				const { id } = input;
				const { data: current } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.bot.findEditor(
							{
								id,
							},
							options,
						),
				).pipe(expectType("bot", id));
				const payload = updateBotPayload(input, current);
				const { templateBlockId, databaseBlockIds } = payload;

				return yield* callProcedure(deps, (procedures, options) =>
					procedures.bot.save(payload, options),
				).pipe(
					mutation("getBot"),
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
				);
			}),
	});
