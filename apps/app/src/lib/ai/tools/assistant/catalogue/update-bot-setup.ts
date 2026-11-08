import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { writeSetup } from "../bots/bot-setup";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { updateBotSetupInputSchema } from "./update-bot-setup.declaration";

export const updateBotSetupTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Set or remove a bot's model in the active organisation, with how many of its audience a quota pool covers. It works for bots added from the Catalogue, which only their home organisation edits. For the organisation's own bots, updateBot does the same alongside other changes.",
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
