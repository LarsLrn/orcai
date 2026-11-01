import type { BlockId } from "@orcai/core";
import { blockFieldsSchema, publicationStatusSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	createOnce,
	effectTool,
	mutation,
} from "../procedure-tool";
import { behaviourOutline, blockDescription } from "./block-outline";

export const createBehaviourInputSchema = z.strictObject({
	name: z.string().min(1).describe("The behaviour's name, a few words."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe("Short plain-text description, up to 500 characters."),
	systemPrompt: z
		.string()
		.describe(
			"The system prompt that sets how a bot using it answers, in Markdown: a short # heading in sentence case over each part it covers, such as role, audience, task, tone and length, and limits, with sentences or a list under each. Give measures, such as two to four sentences per answer, and fit the length to the task. Leave out searching and citing, which OrcAI handles.",
		),
	status: publicationStatusSchema
		.optional()
		.describe("ready: Published, so bots can use it. Defaults to draft."),
});

export const createBehaviourTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new behaviour: the reusable system prompt that sets how a bot answers. To change an existing one, use updateBehaviour.",
		inputSchema: createBehaviourInputSchema,
		run: (input, { toolCallId }) =>
			createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: callProcedure(deps, (procedures, options) =>
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
					ids: (behaviour) => [
						behaviour.id,
					],
					replay: ([behaviourId]) =>
						callProcedure(deps, (procedures, options) =>
							procedures.block.find(
								{
									id: behaviourId as BlockId,
								},
								options,
							),
						).pipe(Effect.map(({ data }) => behaviourOutline(data))),
				},
			),
	});
