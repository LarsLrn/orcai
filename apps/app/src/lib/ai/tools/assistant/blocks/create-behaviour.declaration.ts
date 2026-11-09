import { blockFieldsSchema, publicationStatusSchema } from "@orcai/schema";
import { ScrollTextIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createBehaviourTool } from "./create-behaviour";

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

export const createBehaviour = declareTool<typeof createBehaviourTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: createBehaviourInputSchema,
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_create_behaviour_name(),
	active: () => m.assistant_tool_create_behaviour_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_behaviour_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_behaviour_name();
	},
	written: ({ id, name }) => ({
		kind: "behaviour",
		id,
		name,
	}),
});
