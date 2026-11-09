import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	mutation,
} from "../procedure-tool";
import { behaviourOutline, blockDescription } from "./block-outline";
import { createBehaviourInputSchema } from "./create-behaviour.declaration";

export const createBehaviourTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new behaviour: the reusable system prompt that sets how a bot answers. To change an existing one, use updateBehaviour.",
		inputSchema: createBehaviourInputSchema,
		run: (input) =>
			callProcedure(deps, (procedures, options) =>
				procedures.block.create(
					{
						type: "behaviour",
						name: input.name,
						description:
							input.description === undefined
								? null
								: blockDescription(input.description),
						contentJson: null,
						status: input.status ?? "draft",
						config: {
							systemPrompt: input.systemPrompt,
						},
					},
					options,
				),
			).pipe(
				mutation("findBlocks"),
				Effect.map(({ data }) => behaviourOutline(data)),
			),
	});
