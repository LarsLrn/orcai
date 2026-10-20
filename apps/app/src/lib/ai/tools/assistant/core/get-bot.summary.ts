import { BotIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const getBotSummary = defineToolSummary<"getBot">({
	icon: BotIcon,
	name: () => m.assistant_tool_get_bot_name(),
	active: () => m.assistant_tool_get_bot_active(),
	refs: (part) =>
		part.state === "output-available" || !part.input
			? []
			: [
					{
						kind: "bot",
						id: part.input.id,
					},
				],
	line: (part, nameOf) => {
		const name =
			part.state === "output-available"
				? part.output.name
				: part.input
					? nameOf({
							kind: "bot",
							id: part.input.id,
						})
					: undefined;

		return name === undefined
			? m.assistant_tool_get_bot_name()
			: m.assistant_tool_get_bot_summary({
					name: m.assistant_tool_quoted_name({
						name,
					}),
				});
	},
});
