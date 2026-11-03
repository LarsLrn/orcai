import { LibraryIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
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
	...batchSummary<typeof updateRepositoryTool>({
		kind: "repository",
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
		summary: m.assistant_tool_update_repository_summary,
	}),
	written: ({ id, name }) => ({
		kind: "repository",
		id,
		name,
	}),
});
