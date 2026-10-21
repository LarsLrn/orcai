import type { BotEditor } from "@orcai/schema";

/** What a bot tool tells the model about the bot it wrote. */
export const botOutline = (bot: BotEditor) => ({
	type: "bot" as const,
	id: bot.id,
	name: bot.name,
	description: bot.description,
	status: bot.status,
	features: bot.features,
	template: bot.templateBlock
		? {
				type: "template" as const,
				id: bot.templateBlock.id,
				name: bot.templateBlock.name,
				status: bot.templateBlock.status,
			}
		: null,
	repositories: bot.databaseBlocks.map((block) => ({
		id: block.id,
		name: block.name,
		status: block.status,
		assetCount: block.assetIds.length,
	})),
});
