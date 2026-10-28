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
import { blockDescription, templateOutline } from "./block-outline";

export const createTemplateInputSchema = z.strictObject({
	name: z.string().min(1),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe("Short plain-text description, up to 500 characters."),
	systemPrompt: z
		.string()
		.describe("The system prompt that sets how a bot using it answers."),
	status: publicationStatusSchema
		.optional()
		.describe("ready makes it available to bots. Defaults to draft."),
});

export const createTemplateTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Create a new behaviour block (template): the reusable system prompt a bot follows. To change an existing one, use updateTemplate.",
		inputSchema: createTemplateInputSchema,
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
								type: "template",
								name: input.name,
								description:
									input.description === undefined
										? null
										: blockDescription(input.description),
								contentJson: null,
								contentHtml: null,
								status: input.status ?? "draft",
								config: {
									systemPrompt: input.systemPrompt,
								},
							},
							options,
						),
					).pipe(
						mutation("findBlocks"),
						Effect.map(({ data }) => templateOutline(data)),
					),
					ids: (template) => [
						template.id,
					],
					replay: ([templateId]) =>
						callProcedure(deps, (procedures, options) =>
							procedures.block.find(
								{
									id: templateId as BlockId,
								},
								options,
							),
						).pipe(Effect.map(({ data }) => templateOutline(data))),
				},
			),
	});
