import {
	blockFieldsSchema,
	blockIdSchema,
	publicationStatusSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { blockProcedures } from "@/lib/orpc/router/block";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	expectType,
	mutation,
} from "../procedure-tool";
import {
	blockDescription,
	templateOutline,
	wrongBlockError,
} from "./block-outline";

export const updateTemplateInputSchema = z.object({
	id: blockIdSchema.describe("Id of the behaviour block to update."),
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
			"The system prompt that sets how a bot using it answers. Leave out to keep the current one.",
		),
	status: publicationStatusSchema
		.optional()
		.describe(
			"ready makes it available to bots. Leave out to keep the current status.",
		),
});

export const updateTemplateTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Update an existing behaviour block (template): name, description, system prompt and status. Give only the fields that change; everything else, including rich content, is kept. To create one, use createTemplate.",
		inputSchema: updateTemplateInputSchema,
		execute: (input, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const { id } = input;
					const { data: current } = yield* callProcedure(deps, (options) =>
						blockProcedures.find(
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

					const { data } = yield* callProcedure(deps, (options) =>
						blockProcedures.update(
							{
								id,
								type: "template",
								name: input.name ?? current.name,
								description:
									input.description === undefined
										? current.description
										: blockDescription(input.description),
								contentJson: current.contentJson,
								contentHtml: current.contentHtml,
								status: input.status ?? current.status,
								config: {
									...current.config,
									systemPrompt:
										input.systemPrompt ?? current.config.systemPrompt,
								},
							},
							options,
						),
					).pipe(mutation("getBlock"));

					return templateOutline(data);
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
