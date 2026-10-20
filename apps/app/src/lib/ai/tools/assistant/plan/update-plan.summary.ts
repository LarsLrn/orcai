import { ListTodoIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";
import { planTally } from "./plan-tally";

export const updatePlanSummary = defineToolSummary<"updatePlan">({
	icon: ListTodoIcon,
	name: () => m.assistant_tool_update_plan_name(),
	active: () => m.assistant_tool_update_plan_active(),
	line: (part) =>
		part.input?.title && part.input.items
			? m.assistant_tool_update_plan_summary({
					title: formatNames([
						part.input.title,
					]),
					tally: planTally(part.input.items),
				})
			: m.assistant_tool_update_plan_name(),
});
