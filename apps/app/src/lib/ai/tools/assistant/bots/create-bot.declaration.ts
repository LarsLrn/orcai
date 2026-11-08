import { blockIdSchema, botFieldsSchema } from "@orcai/schema";
import { BotIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createBotTool } from "./create-bot";
import { featuresInputSchema } from "./features-input";
import { setupInputSchema } from "./setup-input";

export const createBotInputSchema = z.strictObject({
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description.describe(
		"Short plain-text description shown with the bot, up to 500 characters.",
	),
	behaviourId: blockIdSchema
		.optional()
		.describe(
			"Id of the behaviour the bot follows, from findBlocks or createBehaviour.",
		),
	repositoryIds: z
		.array(blockIdSchema)
		.optional()
		.describe("Ids of every repository the bot answers from."),
	features: featuresInputSchema
		.optional()
		.describe(
			"Every enabled feature, such as { generativeUi: {}, webSearch: { allowedDomains: [] } }.",
		),
	setup: setupInputSchema.optional(),
});

export const createBot = declareTool<typeof createBotTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: createBotInputSchema,
	icon: BotIcon,
	name: () => m.assistant_tool_create_bot_name(),
	active: () => m.assistant_tool_create_bot_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_bot_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_bot_name();
	},
	written: ({ id, name }) => ({
		kind: "bot",
		id,
		name,
	}),
});
