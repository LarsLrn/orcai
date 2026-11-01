import type { BotEditor } from "@orcai/schema";

/** What a bot tool tells the model about the bot it wrote. */
export const botOutline = (bot: BotEditor) => ({
	type: "bot" as const,
	id: bot.id,
	name: bot.name,
	description: bot.description,
	status: bot.status,
	features: bot.features,
	behaviour: bot.behaviour
		? {
				type: "behaviour" as const,
				id: bot.behaviour.id,
				name: bot.behaviour.name,
				status: bot.behaviour.status,
			}
		: null,
	repositories: bot.repositories.map((block) => ({
		id: block.id,
		name: block.name,
		status: block.status,
		assetCount: block.assetIds.length,
	})),
});
