import type { BlockId } from "@orcai/core";
import type { BotEditor, SaveBotInput } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectLinkableBlocks,
	expectType,
	mutation,
} from "../procedure-tool";
import { botOutline } from "./bot-outline";
import { writeSetup } from "./bot-setup";
import { updateBotInputSchema } from "./update-bot.declaration";

/** The parts of the stored bot an update keeps when the model leaves them out. */
type StoredBot = Pick<
	BotEditor,
	"id" | "name" | "description" | "contentJson" | "status" | "features"
> & {
	behaviour: {
		id: BlockId;
	} | null;
	repositories: {
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
	status: current.status,
	behaviourId:
		input.behaviourId === undefined
			? (current.behaviour?.id ?? null)
			: input.behaviourId,
	repositoryIds:
		input.repositoryIds ?? current.repositories.map((block) => block.id),
	features: input.features ?? current.features,
	// The assistant never lists; a listed bot's new blocks wait for the owner in the app.
	listBlockIds: [],
});

export const updateBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Update an existing bot: name, description, behaviour, repositories, features and its model in the active organisation, with how many of its audience a quota pool covers. Give only the fields that change. Everything else, including the status and the rich description, is kept. A setup that fails comes back as setupError while the other changes are saved. To create a bot, use createBot.",
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
				const { behaviourId, repositoryIds } = payload;

				const bot = yield* callProcedure(deps, (procedures, options) =>
					procedures.bot.save(payload, options),
				).pipe(
					mutation("getBot"),
					expectLinkableBlocks(behaviourId, repositoryIds),
					expectType("block", [
						...(behaviourId
							? [
									behaviourId,
								]
							: []),
						...repositoryIds,
					]),
					expectType("behaviour", behaviourId ?? []),
					expectType("repository", repositoryIds),
					Effect.map(({ data }) => botOutline(data)),
				);
				return input.setup === undefined
					? bot
					: {
							...bot,
							...(yield* writeSetup(deps, id, input.setup)),
						};
			}),
	});
