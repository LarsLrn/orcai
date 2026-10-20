import { BotIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const createBotSummary = defineToolSummary<"createBot">({
	icon: BotIcon,
	name: () => m.assistant_tool_create_bot_name(),
	active: () => m.assistant_tool_create_bot_active(),
	line: (part) => {
		const name =
			part.state === "output-available" ? part.output.name : part.input?.name;

		return name
			? m.assistant_tool_create_bot_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_bot_name();
	},
});
