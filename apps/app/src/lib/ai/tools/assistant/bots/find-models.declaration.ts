import { CpuIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { findModelsTool } from "./find-models";

export const findModels = declareTool<typeof findModelsTool>()({
	kind: "read",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: CpuIcon,
	name: () => m.assistant_tool_find_models_name(),
	active: () => m.assistant_tool_find_models_active(),
	line: ({ output }) =>
		output
			? m.assistant_tool_find_models_summary({
					count: output.total,
				})
			: m.assistant_tool_find_models_name(),
});
