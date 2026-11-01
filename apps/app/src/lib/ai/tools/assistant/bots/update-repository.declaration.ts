import { LibraryIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateRepositoryTool } from "./update-repository";

export const updateRepository = declareTool<typeof updateRepositoryTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: LibraryIcon,
	name: () => m.assistant_tool_update_repository_name(),
	active: () => m.assistant_tool_update_repository_active(),
	refs: ({ input, output }) =>
		!output && input && !input.name
			? [
					{
						kind: "repository",
						id: input.id,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		const name = output
			? output.name
			: input &&
				(input.name ??
					nameOf({
						kind: "repository",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_repository_name()
			: m.assistant_tool_update_repository_summary({
					name: formatNames([
						name,
					]),
				});
	},
	written: ({ id, name }) => ({
		kind: "repository",
		id,
		name,
	}),
});
