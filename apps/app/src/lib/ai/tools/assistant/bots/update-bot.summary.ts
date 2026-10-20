import { BotIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const updateBotSummary = defineToolSummary<"updateBot">({
	icon: BotIcon,
	name: () => m.assistant_tool_update_bot_name(),
	active: () => m.assistant_tool_update_bot_active(),
	refs: (part) =>
		part.state !== "output-available" && part.input && !part.input.name
			? [
					{
						kind: "bot",
						id: part.input.id,
					},
				]
			: [],
	line: (part, nameOf) => {
		const name =
			part.state === "output-available"
				? part.output.name
				: part.input &&
					(part.input.name ??
						nameOf({
							kind: "bot",
							id: part.input.id,
						}));

		return name === undefined
			? m.assistant_tool_update_bot_name()
			: m.assistant_tool_update_bot_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
