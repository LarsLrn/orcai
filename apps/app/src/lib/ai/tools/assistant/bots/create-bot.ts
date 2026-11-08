import type { SaveBotInput } from "@orcai/schema";
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
import { createBotInputSchema } from "./create-bot.declaration";

/** A new bot is a draft with empty rich content. */
export const createBotPayload = (
	input: z.infer<typeof createBotInputSchema>,
): SaveBotInput => ({
	name: input.name,
	description: input.description,
	contentJson: {},
	status: "draft",
	behaviourId: input.behaviourId ?? null,
	repositoryIds: input.repositoryIds ?? [],
	features: input.features ?? {},
	listBlockIds: [],
});

export const createBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new draft bot with its name and description, and optionally its behaviour, repositories, features and its model in the active organisation. The result says how many of the bot's audience a quota pool covers. A setup that fails comes back as setupError next to the created bot, so fix it with updateBot. To change an existing bot, use updateBot. To publish it, use publishBot.",
		inputSchema: createBotInputSchema,
		run: (input) => {
			const payload = createBotPayload(input);
			const { behaviourId, repositoryIds } = payload;

			return callProcedure(deps, (procedures, options) =>
				procedures.bot.save(payload, options),
			).pipe(
				mutation("findBots"),
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
			);
		},
	});
