import {
	GraduationCapIcon,
	Grid3x3Icon,
	ListChecksIcon,
	type LucideIcon,
	SpellCheckIcon,
} from "lucide-react";
import type { ToolDeclaration } from "@/lib/ai/tools/declaration";
import {
	type DisplayToolName,
	displayToolMarkdown,
	primitiveCatalog,
} from "@/lib/ai/tools/gen-ui/catalog";
import { m } from "@/paraglide/messages";

const workLogLabels: Record<
	DisplayToolName,
	{
		icon: LucideIcon;
		name: () => string;
		active: () => string;
	}
> = {
	showChecklist: {
		icon: ListChecksIcon,
		name: () => m.chat_work_log_tool_show_checklist_name(),
		active: () => m.chat_work_log_tool_show_checklist_active(),
	},
	showReview: {
		icon: SpellCheckIcon,
		name: () => m.chat_work_log_tool_show_review_name(),
		active: () => m.chat_work_log_tool_show_review_active(),
	},
	showMatrix: {
		icon: Grid3x3Icon,
		name: () => m.chat_work_log_tool_show_matrix_name(),
		active: () => m.chat_work_log_tool_show_matrix_active(),
	},
	showQuizResult: {
		icon: GraduationCapIcon,
		name: () => m.chat_work_log_tool_show_quiz_result_name(),
		active: () => m.chat_work_log_tool_show_quiz_result_active(),
	},
};

type DisplayDeclaration = ToolDeclaration & {
	kind: "display";
	group: "core";
};

/** The display tools' declarations, in the catalog's order. */
export const displayTools = Object.fromEntries(
	Object.entries(workLogLabels).map(
		([name, labels]): [
			string,
			DisplayDeclaration,
		] => [
			name,
			{
				kind: "display",
				group: "core",
				inputSchema: primitiveCatalog[name as DisplayToolName].schema,
				...labels,
				markdown: ({ input, output }) =>
					displayToolMarkdown(name as DisplayToolName, input, output) ??
					undefined,
			},
		],
	),
) as Record<DisplayToolName, DisplayDeclaration>;
