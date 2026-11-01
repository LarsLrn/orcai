import { publishBotInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { botOutline } from "./bot-outline";

export const publishBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Publish a draft bot so the people it is shared with can chat with it. It needs a published behaviour, and every linked repository published with at least one asset. Otherwise the error names what is missing.",
		inputSchema: publishBotInputSchema.strict(),
		run: ({ id }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.bot.publish(
					{
						id,
					},
					options,
				),
			).pipe(
				mutation("getBot"),
				expectType("bot", id),
				Effect.map(({ data }) => botOutline(data)),
			),
	});
