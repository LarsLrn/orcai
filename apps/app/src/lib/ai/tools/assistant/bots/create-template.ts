import type { BlockId } from "@orcai/core";
import { blockFieldsSchema, publicationStatusSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { blockProcedures } from "@/lib/orpc/router/block";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	createOnce,
	mutation,
} from "../procedure-tool";
import { blockDescription, templateOutline } from "./block-outline";

export const createTemplateInputSchema = z.object({
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
	assistantTool({
		description:
			"Create a new behaviour block (template): the reusable system prompt a bot follows. To change an existing one, use updateTemplate.",
		inputSchema: createTemplateInputSchema,
		execute: (input, { abortSignal, toolCallId }) =>
			runAssistantTool(
				createOnce(
					{
						scope: deps.turn.scope,
						toolName: "createTemplate",
						toolCallId,
						input,
					},
					{
						create: callProcedure(deps, (options) =>
							blockProcedures.create(
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
							callProcedure(deps, (options) =>
								blockProcedures.find(
									{
										id: templateId as BlockId,
									},
									options,
								),
							).pipe(Effect.map(({ data }) => templateOutline(data))),
					},
				),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
