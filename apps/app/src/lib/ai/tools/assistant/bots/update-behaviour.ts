import {
	blockFieldsSchema,
	blockIdSchema,
	publicationStatusSchema,
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
import {
	behaviourOutline,
	blockDescription,
	wrongBlockError,
} from "./block-outline";

const updateBehaviourInputSchema = z.strictObject({
	id: blockIdSchema.describe("Id of the behaviour to update."),
	name: z
		.string()
		.min(1)
		.optional()
		.describe("Leave out to keep the current name."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe(
			"Short plain-text description, up to 500 characters. Leave out to keep the current one.",
		),
	systemPrompt: z
		.string()
		.optional()
		.describe(
			"The whole new system prompt, in the Markdown form createBehaviour describes. Leave out to keep the current one.",
		),
	status: publicationStatusSchema
		.optional()
		.describe(
			"ready: Published, so bots can use it. Leave out to keep the current status.",
		),
});

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
				).pipe(expectType("template", id));

				if (current.type !== "template") {
					return yield* Effect.fail(
						wrongBlockError("template", id, current.type),
					);
				}

				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.block.update(
						{
							id,
							type: "template",
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
