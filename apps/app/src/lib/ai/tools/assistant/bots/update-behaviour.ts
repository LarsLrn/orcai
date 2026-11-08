import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import {
	behaviourOutline,
	blockDescription,
	wrongBlockError,
} from "./block-outline";
import { updateBehaviourInputSchema } from "./update-behaviour.declaration";

export const updateBehaviourTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Update an existing behaviour: name, description, system prompt and status. Give only the fields that change. Everything else, including its rich content, is kept. To create one, use createBehaviour.",
		inputSchema: updateBehaviourInputSchema,
		run: (input) =>
			Effect.gen(function* () {
				const { id } = input;
				const { data: current } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.block.find(
							{
								id,
							},
							options,
						),
				).pipe(expectType("behaviour", id));

				if (current.type !== "behaviour") {
					return yield* Effect.fail(
						wrongBlockError("behaviour", id, current.type),
					);
				}

				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.block.update(
						{
							id,
							type: "behaviour",
							name: input.name ?? current.name,
							description:
								input.description === undefined
									? current.description
									: blockDescription(input.description),
							contentJson: current.contentJson,
							status: input.status ?? current.status,
							config: {
								...current.config,
								systemPrompt: input.systemPrompt ?? current.config.systemPrompt,
							},
						},
						options,
					),
				).pipe(mutation("getBlock"));

				return behaviourOutline(data);
			}),
	});
