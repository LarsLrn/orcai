import { publishBotInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { botProcedures } from "@/lib/orpc/router/bot";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";
import { botOutline } from "./bot-outline";

export { publishBotInputSchema };

export const publishBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Publish a draft bot so its audience can chat with it. Needs a ready behaviour block, and every linked repository ready with at least one asset; otherwise the error names what is missing.",
		inputSchema: publishBotInputSchema,
		run: ({ id }) =>
			callProcedure(deps, (options) =>
				botProcedures.publish(
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
