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
					type: "tool-searchRepositories",
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

	describe("citations", () => {
		const citations = {
			kgol9ts: {
				kind: "asset",
				assetId: "a2",
				title: "Refund policy.pdf",
				page: 4,
			},
			k5m2x0q: {
				kind: "asset",
				assetId: "a3",
				title: "Travel policy",
			},
			do8r8j2: {
				kind: "docs",
				path: "/docs/using-orcai/bots",
				title: "Bots",
			},
			w2jpxug: {
				kind: "web",
				url: "https://www.who.int/news-room/fact-sheets/detail/malaria",
				title: "Malaria",
			},
		};
		const cited = message(
			"assistant",
			[
				text(
					[
						"Paid <cite ref=kgol9ts>within 14 days</cite>.",
						'Booked <cite ref="k5m2x0q">by train</cite>.',
						"Set up <cite ref=do8r8j2>in the Library</cite>.",
						"Spread <cite ref=w2jpxug>by mosquitoes</cite>.",
						"Kept <cite ref=k000000>for a year</cite>.",
					].join(" "),
				),
			],
			{
				citations,
			},
		);

		test("writes each cite as the cited text and its source", () => {
			expect(
				messageToMarkdown(cited, {
					docsUrl: "https://docs.example.org/",
				}),
			).toBe(
				"Paid within 14 days (Refund policy, p. 4). Booked by train (Travel policy). Set up in the Library (Bots, https://docs.example.org/docs/using-orcai/bots). Spread by mosquitoes (Malaria, https://www.who.int/news-room/fact-sheets/detail/malaria). Kept for a year.",
			);
		});

		test("writes cites in a transcript the same way", () => {
			expect(messageToTranscriptMarkdown(cited)).toContain(
				"Paid within 14 days (Refund policy, p. 4).",
			);
		});

		test("names a docs page by its title without the docs URL", () => {
			expect(messageToMarkdown(cited)).toContain(
				"Set up in the Library (Bots).",
			);
		});

		test("writes cites in nested prose fields of display parts", () => {
			const markdown = messageToMarkdown(
				message(
					"assistant",
					[
						{
							type: "tool-showChecklist",
							toolCallId: "call-1",
							state: "output-available",
							input: {
								...checklistInput,
								items: [
									{
										...checklistInput.items[0],
										body: "Listed <cite ref=kgol9ts>in full</cite>.",
									},
								],
							},
							output: {
								shown: true,
							},
						},
					],
					{
						citations,
					},
				),
			);

			expect(markdown).toContain("Listed in full (Refund policy, p. 4).");
			expect(markdown).not.toContain("<cite");
		});
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
