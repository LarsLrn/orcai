import { ListTodoIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { planTally } from "./plan-tally";
import type { updatePlanTool } from "./update-plan";

export const updatePlan = declareTool<typeof updatePlanTool>()({
	kind: "plan",
	group: "core",
	icon: ListTodoIcon,
	name: () => m.assistant_tool_update_plan_name(),
	active: () => m.assistant_tool_update_plan_active(),
	line: ({ input }) =>
		input?.title && input.items
			? m.assistant_tool_update_plan_summary({
					title: formatNames([
						input.title,
					]),
					tally: planTally(input.items),
				})
			: m.assistant_tool_update_plan_name(),
});
