import { RocketIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const publishBotSummary = defineToolSummary<"publishBot">({
	icon: RocketIcon,
	name: () => m.assistant_tool_publish_bot_name(),
	active: () => m.assistant_tool_publish_bot_active(),
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
				: part.input &&
					nameOf({
						kind: "bot",
						id: part.input.id,
					});

		return name === undefined
			? m.assistant_tool_publish_bot_name()
			: m.assistant_tool_publish_bot_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
