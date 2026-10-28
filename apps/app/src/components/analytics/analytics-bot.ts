import type { AnalyticsBot } from "@orcai/schema";
import { m } from "@/paraglide/messages";

export const analyticsBotKey = (bot: AnalyticsBot) =>
	bot.kind === "bot" ? bot.id : bot.kind;

export const analyticsBotName = (bot: AnalyticsBot) => {
	switch (bot.kind) {
		case "bot":
			return bot.name;
		case "none":
			return m.analytics_without_bot_label();
		case "other":
			return m.analytics_other_bots_label();
	}
};
