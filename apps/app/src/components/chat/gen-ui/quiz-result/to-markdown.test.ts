import { describe, expect, test } from "bun:test";
import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import {
	capitalsAnswers,
	capitalsQuiz,
} from "@/lib/ai/tools/questions/fixtures";
import { gradeQuiz } from "@/lib/ai/tools/questions/quiz-result";

const graded = gradeQuiz(
	{
		input: capitalsQuiz,
		output: capitalsAnswers,
	},
	{
		results: [
			{
				question: 1,
				verdict: "correct",
			},
			{
				question: 2,
				verdict: "partly_correct",
				earned: 1.5,
				expected: "Berlin and Vienna",
				explanation: "Vienna is a capital too.",
			},
			{
				question: 3,
				verdict: "incorrect",
				expected: "Tokyo",
			},
		],
	},
);

describe("quizResultToMarkdown", () => {
	test("puts a correct question on one line and explains the rest, with totals", () => {
		expect(
			displayToolMarkdown(
				"showQuizResult",
				{},
				graded.ok ? graded.result : undefined,
			),
		).toBe(
			[
				"### Capitals: 2.5 of 4 points",
				"#### Europe: 2.5 of 3 points",
				[
					"1. **Capital of France?** (Correct, 1 of 1 point)",
					"2. **Which are capitals?** (Partly correct, 1.5 of 2 points)",
					"",
					"   Your answer: Berlin",
					"",
					"   Expected: Berlin and Vienna",
					"",
					"   Vienna is a capital too.",
				].join("\n"),
				"#### Asia: 0 of 1 point",
				[
					"3. **Capital of Japan?** (Incorrect, 0 of 1 point)",
					"",
					"   Your answer: _Not answered_",
					"",
					"   Expected: Tokyo",
				].join("\n"),
			].join("\n\n"),
		);
	});

	test("has nothing to show before the call ran", () => {
		expect(displayToolMarkdown("showQuizResult", {})).toBeNull();
	});
});
