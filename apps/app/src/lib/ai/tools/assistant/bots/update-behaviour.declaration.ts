import {
	blockFieldsSchema,
	blockIdSchema,
	publicationStatusSchema,
} from "@orcai/schema";
import { ScrollTextIcon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateBehaviourTool } from "./update-behaviour";

export const updateBehaviourInputSchema = z.strictObject({
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
			"ready: Published, so bots can use it. draft moves the published bots using it to Draft. Leave out to keep the current status.",
		),
});

export const updateBehaviour = declareTool<typeof updateBehaviourTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: updateBehaviourInputSchema,
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_update_behaviour_name(),
	active: () => m.assistant_tool_update_behaviour_active(),
	...batchSummary<typeof updateBehaviourTool>({
		kind: "behaviour",
		ids: (input) =>
			input && [
				input.id,
			],
		pendingName: (input) => input.name,
		named: (output) => [
			{
				id: output.id,
				name: output.name,
			},
		],
		summary: m.assistant_tool_update_behaviour_summary,
	}),
	written: ({ id, name }) => ({
		kind: "behaviour",
		id,
		name,
	}),
});
