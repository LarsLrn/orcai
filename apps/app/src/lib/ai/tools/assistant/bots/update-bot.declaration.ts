import { blockIdSchema, botFieldsSchema, botIdSchema } from "@orcai/schema";
import { BotIcon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import { featuresInputSchema } from "./features-input";
import { setupInputSchema } from "./setup-input";
import type { updateBotTool } from "./update-bot";

export const updateBotInputSchema = z.strictObject({
	id: botIdSchema.describe("Id of the bot to update."),
	name: botFieldsSchema.shape.name
		.optional()
		.describe("Leave out to keep the current name."),
	description: botFieldsSchema.shape.description
		.optional()
		.describe(
			"Short plain-text description shown with the bot, up to 500 characters. Leave out to keep the current one.",
		),
	behaviourId: blockIdSchema
		.nullable()
		.optional()
		.describe(
			"Id of the behaviour the bot follows; null unlinks it. Leave out to keep the current one.",
		),
	repositoryIds: z
		.array(blockIdSchema)
		.optional()
		.describe(
			"Ids of every repository the bot answers from; replaces the current list. Leave out to keep it.",
		),
	features: featuresInputSchema
		.optional()
		.describe(
			"Every enabled feature, such as { generativeUi: {}, webSearch: { allowedDomains: [] } }; replaces the current set. Leave out to keep it.",
		),
	setup: setupInputSchema.optional(),
});

export const updateBot = declareTool<typeof updateBotTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: updateBotInputSchema,
	icon: BotIcon,
	name: () => m.assistant_tool_update_bot_name(),
	active: () => m.assistant_tool_update_bot_active(),
	...batchSummary<typeof updateBotTool>({
		kind: "bot",
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
		summary: m.assistant_tool_update_bot_summary,
	}),
	written: ({ id, name }) => ({
		kind: "bot",
		id,
		name,
	}),
});
