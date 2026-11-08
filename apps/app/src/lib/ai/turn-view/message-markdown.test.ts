import { afterEach, describe, expect, test } from "bun:test";
import type { ChatMessageMetadata, ChatMessagePart } from "@orcai/schema";
import { storedPart, textPart, uiMessage } from "@/lib/ai/test-parts";
import { displayToolMarkdown } from "@/lib/ai/tools/gen-ui/catalog";
import {
	capitalsAnswers,
	capitalsQuiz,
} from "@/lib/ai/tools/questions/fixtures";
import {
	gradeQuiz,
	type QuizGrading,
} from "@/lib/ai/tools/questions/quiz-result";
import { askUserMarkdown } from "@/lib/ai/tools/questions/to-markdown";
import { type MessageView, turnView } from "@/lib/ai/turn-view/turn-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
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

/** A stored message's view, as the chat shows it. */
const message = (
	role: "user" | "assistant",
	parts: ChatMessagePart[],
	metadata?: ChatMessageMetadata,
): MessageView => {
	const [view] = turnView(
		[
			uiMessage({
				role,
				parts: parts.map(storedPart),
				metadata,
			}),
		],
		"idle",
	).messages;
	if (!view) throw new Error("The message has no view");
	return view;
};

const text = (content: string) => textPart(content);

describe("messageToMarkdown", () => {
	test("renders answered questions and a graded quiz", () => {
		const quiz = {
			input: capitalsQuiz,
			output: capitalsAnswers,
		};
		const grading = {
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
		} satisfies QuizGrading;
		const graded = gradeQuiz(quiz, grading);
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
						input: grading,
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
		const citations: ChatMessageMetadata["citations"] = {
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
	const originalGetLocale = getLocale;

	afterEach(() => {
		overwriteGetLocale(originalGetLocale);
	});

	test("puts the speaker on its own paragraph before a code fence", () => {
		overwriteGetLocale(() => "en");

		expect(
			messageToTranscriptMarkdown(
				message("assistant", [
					text("```ts\nconst a = 1;\n```"),
				]),
			),
		).toBe("**Model:**\n\n```ts\nconst a = 1;\n```");
	});

	test("puts the speaker on its own paragraph before a list", () => {
		overwriteGetLocale(() => "en");

		expect(
			messageToTranscriptMarkdown(
				message("user", [
					text("- first\n- second"),
				]),
			),
		).toBe("**You:**\n\n- first\n- second");
	});

	test("names a question's files before its text, also with no text", () => {
		overwriteGetLocale(() => "en");
		const asked = (parts: unknown[]) =>
			turnView(
				[
					{
						id: "message-1",
						role: "user",
						parts,
						attachments: [
							{
								assetId: "asset-1",
								title: "Notes.pdf",
								fileType: "application/pdf",
								size: 10,
							},
							{
								assetId: "asset-2",
								title: "Plan.png",
								fileType: "image/png",
								size: 10,
							},
						],
					} as unknown as ChatAgentUIMessage,
				],
				"idle",
			).messages[0] as MessageView;

		expect(messageToTranscriptMarkdown(asked([]))).toBe(
			"**You:**\n\nAttached: Notes.pdf, Plan.png",
		);
		expect(
			messageToTranscriptMarkdown(
				asked([
					text("Compare them"),
				]),
			),
		).toBe("**You:**\n\nAttached: Notes.pdf, Plan.png\n\nCompare them");
	});

	test("labels the speakers in the locale of the reader", () => {
		overwriteGetLocale(() => "de");

		expect(
			messageToTranscriptMarkdown(
				message("user", [
					text("Hallo"),
				]),
			),
		).toBe("**Sie:**\n\nHallo");
		expect(
			messageToTranscriptMarkdown(
				message("assistant", [
					text("Guten Tag"),
				]),
			),
		).toBe("**Modell:**\n\nGuten Tag");
	});

	test("names a reply after the model that wrote it", () => {
		overwriteGetLocale(() => "en");

		expect(
			messageToTranscriptMarkdown(
				message(
					"assistant",
					[
						text("Hello"),
					],
					{
						model: "gpt-test",
					},
				),
			),
		).toBe("**gpt-test:**\n\nHello");
	});

	test("names a reply after the chat's bot", () => {
		overwriteGetLocale(() => "en");

		expect(
			messageToTranscriptMarkdown(
				message(
					"assistant",
					[
						text("Hello"),
					],
					{
						model: "gpt-test",
					},
				),
				{
					kind: "chat",
					botName: "Field guide",
				},
			),
		).toBe("**Field guide:**\n\nHello");
	});

	test("names an Assistant conversation's replies after the Assistant in both locales", () => {
		const reply = message("assistant", [
			text("Done"),
		]);
		const conversation = {
			kind: "assistant",
			botName: null,
		} as const;

		overwriteGetLocale(() => "en");
		expect(messageToTranscriptMarkdown(reply, conversation)).toBe(
			"**OrcAI Assistant:**\n\nDone",
		);

		overwriteGetLocale(() => "de");
		expect(messageToTranscriptMarkdown(reply, conversation)).toBe(
			"**OrcAI Assistant:**\n\nDone",
		);
	});
});
