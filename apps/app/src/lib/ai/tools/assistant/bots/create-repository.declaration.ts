import { LibraryIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createRepositoryTool } from "./create-repository";

export const createRepository = declareTool<typeof createRepositoryTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: LibraryIcon,
	name: () => m.assistant_tool_create_repository_name(),
	active: () => m.assistant_tool_create_repository_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_repository_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_repository_name();
	},
	written: ({ id, name }) => ({
		kind: "repository",
		id,
		name,
	}),
});
