import { StoreIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CATALOGUE_CAPABILITIES } from "../capabilities";
import type { findCatalogueTool } from "./find-catalogue";

export const findCatalogue = declareTool<typeof findCatalogueTool>()({
	kind: "read",
	group: "bots",
	capabilities: CATALOGUE_CAPABILITIES,
	icon: StoreIcon,
	name: () => m.assistant_tool_find_catalogue_name(),
	active: () => m.assistant_tool_find_catalogue_active(),
	line: ({ output }) =>
		output
			? m.assistant_tool_find_catalogue_summary({
					count: output.total,
				})
			: m.assistant_tool_find_catalogue_name(),
});
