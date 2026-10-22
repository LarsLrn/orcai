import { indent } from "@/components/chat/gen-ui/markdown";
import type { QuizResultView } from "@/components/chat/gen-ui/quiz-result/read";
import { verdictLabel } from "@/components/chat/gen-ui/quiz-result/verdict";
import type { QuizResult } from "@/lib/ai/tools/questions/quiz-result";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

type GradedQuestion = QuizResult["sections"][number]["questions"][number];

const score = ({ earned, points }: { earned: number; points: number }) =>
	m.gen_ui_quiz_score({
		earned: formatCount(earned),
		points: formatCount(points),
		count: points,
	});

const questionToMarkdown = (question: GradedQuestion) => {
	const head = `${question.number}. **${question.prompt}** (${verdictLabel(question.verdict)}, ${score(question)})`;
	if (question.verdict === "correct") {
		return head;
	}
	return [
		head,
		indent(
			[
				`${m.gen_ui_quiz_your_answer()}: ${question.answer ?? `_${m.questions_not_answered()}_`}`,
				question.expected &&
					`${m.gen_ui_quiz_expected()}: ${question.expected}`,
				question.explanation,
			]
				.filter(Boolean)
				.join("\n\n"),
			"   ",
		),
	].join("\n\n");
};

export const quizResultToMarkdown = ({ result }: QuizResultView): string => {
	if (!result) {
		return "";
	}
	const multipleSections = result.sections.length > 1;
	return [
		`### ${result.title ?? m.gen_ui_quiz_result_title()}: ${score(result)}`,
		...result.sections.flatMap((section) => [
			multipleSections &&
				`#### ${section.title ?? m.gen_ui_quiz_section_untitled()}: ${score(section)}`,
			section.questions.map(questionToMarkdown).join("\n"),
		]),
	]
		.filter(Boolean)
		.join("\n\n");
};
