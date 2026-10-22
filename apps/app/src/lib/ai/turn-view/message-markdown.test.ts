import { describe, expect, test } from "bun:test";
import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import {
	capitalsAnswers,
	capitalsQuiz,
} from "@/lib/ai/tools/questions/fixtures";
import { gradeQuiz } from "@/lib/ai/tools/questions/quiz-result";
import { askUserMarkdown } from "@/lib/ai/tools/questions/to-markdown";
import { type MessageView, turnView } from "@/lib/ai/turn-view/turn-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import {
	messageToMarkdown,
	messageToTranscriptMarkdown,
} from "./message-markdown";

const checklistInput = {
	title: "Citation style",
	items: [
		{
			label: "Author names",
			status: "met",
			summary: "All authors are listed.",
		},
	],
};

const message = (
	role: "user" | "assistant",
	parts: unknown[],
	metadata?: unknown,
) =>
	turnView(
		[
			{
				id: "message-1",
				role,
				parts,
				metadata,
			} as unknown as ChatAgentUIMessage,
		],
		"idle",
	).messages[0] as MessageView;

const text = (content: string) => ({
	type: "text",
	text: content,
	state: "done",
});

describe("messageToMarkdown", () => {
	test("renders answered questions and a graded quiz", () => {
		const quiz = {
			input: capitalsQuiz,
			output: capitalsAnswers,
		};
		const graded = gradeQuiz(quiz, {
			results: [
				{
					question: 1,
					verdict: "correct",
				},
				{
					question: 2,
					verdict: "incorrect",
				},
				{
					question: 3,
					verdict: "incorrect",
				},
			],
		});
		const result = graded.ok ? graded.result : undefined;

		expect(
			messageToMarkdown(
				message("assistant", [
					{
						type: "tool-askUser",
						toolCallId: "ask-1",
						state: "output-available",
						...quiz,
					},
					{
						type: "step-start",
					},
					{
						type: "tool-showQuizResult",
						toolCallId: "result-1",
						state: "output-available",
						input: {
							results: [],
						},
						output: result,
					},
					text("Well done."),
				]),
			),
		).toBe(
			[
				askUserMarkdown(quiz),
				displayToolMarkdown("showQuizResult", {}, result),
				"Well done.",
			].join("\n\n"),
		);
	});

	test("walks the answer's text and display parts in order", () => {
		const markdown = messageToMarkdown(
			message("assistant", [
				{
					type: "reasoning",
					text: "thinking",
					state: "done",
				},
				text("let me look"),
				{
					type: "tool-searchKnowledgeBase",
					toolCallId: "call-1",
					state: "output-available",
					input: {
						query: "x",
					},
					output: {
						results: [],
					},
				},
				text("Lead-in"),
				{
					type: "tool-showChecklist",
					toolCallId: "call-2",
					state: "output-available",
					input: checklistInput,
					output: {
						shown: true,
					},
				},
				text("Conclusion"),
			]),
		);

		expect(markdown).toContain("Citation style");
		expect(markdown).toBe(
			[
				"Lead-in",
				displayToolMarkdown("showChecklist", checklistInput),
				"Conclusion",
			].join("\n\n"),
		);
	});

	test("writes both cite forms as the cited text and its source", () => {
		expect(
			messageToMarkdown(
				message(
					"assistant",
					[
						text(
							[
								'Paid <cite chunk="k7f3a2">within 14 days</cite>.',
								'Booked <cite assetid="a1" title="Travel policy" page="2">by train</cite>.',
								'Kept <cite chunk="k000000">for a year</cite>.',
							].join(" "),
						),
					],
					{
						citations: {
							k7f3a2: {
								assetId: "a2",
								title: "Refund policy.pdf",
								page: 4,
							},
						},
					},
				),
			),
		).toBe(
			"Paid within 14 days (Refund policy, p. 4). Booked by train (Travel policy, p. 2). Kept for a year.",
		);
	});

	test("user messages join all their text parts", () => {
		expect(
			messageToMarkdown(
				message("user", [
					text("First"),
					{
						type: "file",
						mediaType: "image/png",
						url: "data:,",
					},
					text("Second"),
				]),
			),
		).toBe("First\n\nSecond");
	});
});

describe("messageToTranscriptMarkdown", () => {
	test("puts the role on its own paragraph before a code fence", () => {
		expect(
			messageToTranscriptMarkdown(
				message("assistant", [
					text("```ts\nconst a = 1;\n```"),
				]),
			),
		).toBe("**Assistant:**\n\n```ts\nconst a = 1;\n```");
	});

	test("puts the role on its own paragraph before a list", () => {
		expect(
			messageToTranscriptMarkdown(
				message("user", [
					text("- first\n- second"),
				]),
			),
		).toBe("**User:**\n\n- first\n- second");
	});
});
