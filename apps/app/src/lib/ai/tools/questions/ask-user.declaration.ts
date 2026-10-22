import { MessageCircleQuestionMarkIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { askUserOutputSchema, type askUserTool } from "./ask-user";
import { askUserMarkdown } from "./to-markdown";

export const askUser = declareTool<typeof askUserTool>()({
	kind: "client",
	group: "core",
	conversational: true,
	outputSchema: askUserOutputSchema,
	icon: MessageCircleQuestionMarkIcon,
	name: () => m.questions_tool_name(),
	active: () => m.questions_tool_active(),
	line: ({ input }) =>
		input?.mode === "quiz"
			? m.questions_tool_summary_quiz({
					count: input.questions.length,
				})
			: m.questions_tool_summary_questions({
					count: input?.questions.length ?? 0,
				}),
	markdown: askUserMarkdown,
});
