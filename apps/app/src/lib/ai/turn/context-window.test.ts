import { describe, expect, test } from "bun:test";
import { providerCompaction } from "@orcai/ai";
import type { ChatMessageMetadata } from "@orcai/schema";
import type { UIMessage } from "ai";
import {
	compactionTrigger,
	fitContextWindow,
	promptBudget,
	SUMMARY_PREFIX,
} from "./context-window";

type Message = UIMessage<ChatMessageMetadata>;

/** A text part the estimate counts as exactly `tokens`. */
const text = (tokens: number) => ({
	type: "text" as const,
	text: "x".repeat(tokens * 4 - 25),
});

const user = (id: string, tokens: number): Message => ({
	id,
	role: "user",
	parts: [
		text(tokens),
	],
});

const reply = (
	id: string,
	tokens: number,
	metadata?: ChatMessageMetadata,
): Message => ({
	id,
	role: "assistant",
	parts: [
		text(tokens),
	],
	metadata,
});

const anthropic = providerCompaction("anthropic", 100_000);
const ownSummary = providerCompaction("openai-compatible", 100_000);

const fit = (
	messages: Message[],
	{
		contextWindow = 10_000,
		reservedOutputTokens = 0,
		...options
	}: Partial<
		Parameters<typeof fitContextWindow>[0] & {
			contextWindow: number | null;
			reservedOutputTokens: number;
		}
	> = {},
) =>
	fitContextWindow({
		messages,
		replyId: "next",
		requestTokens: 0,
		budget: promptBudget({
			contextWindow,
			reservedOutputTokens,
		}),
		compaction: anthropic,
		...options,
	});

const keptIds = (result: ReturnType<typeof fit>) =>
	result.fits ? result.messages.map((message) => message.id) : "refused";

const conversation = [
	user("u1", 3_000),
	reply("a1", 1_000),
	user("u2", 3_000),
	reply("a2", 1_000),
	user("u3", 1_000),
];

const anthropicCompaction = (id: string, summary: string): Message => ({
	id,
	role: "assistant",
	parts: [
		{
			type: "step-start",
		},
		{
			type: "text",
			text: summary,
			providerMetadata: {
				anthropic: {
					type: "compaction",
				},
			},
		},
		text(500),
	],
});
const openAICompaction = (id: string): Message => ({
	id,
	role: "assistant",
	parts: [
		{
			type: "custom",
			kind: "openai.compaction",
			providerMetadata: {
				openai: {
					type: "compaction",
					itemId: "cmp_1",
					encryptedContent: "sealed",
				},
			},
		},
		text(500),
	],
});
const summarized = (id: string, summary: string): Message => ({
	id,
	role: "assistant",
	parts: [
		{
			type: "text",
			text: summary,
			providerMetadata: {
				orcai: {
					type: "compaction",
				},
			},
		},
		text(500),
	],
});
describe("fitContextWindow", () => {
	test("sends everything that fits, with its estimate", () => {
		const result = fit(conversation, {
			requestTokens: 500,
		});

		expect(result).toEqual({
			fits: true,
			messages: conversation,
			trimmed: false,
			estimate: 9_500,
			stepTokens: 9_500,
			summarize: undefined,
		});
	});

	test("leaves out the oldest whole turns first", () => {
		const result = fit(conversation, {
			contextWindow: 7_000,
		});

		expect(keptIds(result)).toEqual([
			"u2",
			"a2",
			"u3",
		]);
		expect(result.fits && result.trimmed).toBe(true);
		expect(result.fits && result.estimate).toBe(5_000);
	});

	test("the reserved output and every request's system prompt and tools take their share", () => {
		expect(
			keptIds(
				fit(conversation, {
					reservedOutputTokens: 1_000,
					requestTokens: 1_000,
				}),
			),
		).toEqual([
			"u2",
			"a2",
			"u3",
		]);
	});

	test("refuses when even the latest turn does not fit", () => {
		expect(
			keptIds(
				fit(conversation, {
					contextWindow: 1_500,
					reservedOutputTokens: 1_000,
				}),
			),
		).toBe("refused");
	});

	test("cuts down to three quarters of the budget, so the next turns do not trim again", () => {
		const result = fit(
			[
				...conversation.slice(0, 4),
				user("u3", 3_000),
				reply("a3", 1_000),
				user("u4", 1_000),
			],
			{
				contextWindow: 10_000,
			},
		);

		// Leaving out u1 and a1 fits at 9 000, still above 7 500.
		expect(keptIds(result)).toEqual([
			"u3",
			"a3",
			"u4",
		]);
	});

	test("a model without a known context window gets 128000 tokens", () => {
		const long = [
			user("u1", 100_000),
			reply("a1", 1_000),
			user("u2", 30_000),
		];

		expect(
			keptIds(
				fit(long, {
					contextWindow: null,
				}),
			),
		).toEqual([
			"u2",
		]);
	});

	test("an image counts as a large one, whatever its URL", () => {
		const withImage: Message[] = [
			user("u1", 1_000),
			reply("a1", 1_000),
			{
				id: "u2",
				role: "user",
				parts: [
					text(100),
					{
						type: "file",
						mediaType: "image/png",
						url: "https://s3.test/a.png",
					},
				],
			},
		];

		expect(
			keptIds(
				fit(withImage, {
					contextWindow: 2_000,
				}),
			),
		).toEqual([
			"u2",
		]);
	});

	describe("with the context tokens the latest reply recorded", () => {
		/** a2 sent 7 000 estimated tokens and wrote 1 000; the provider counted `contextTokens`. */
		const recorded = (contextTokens: number) => [
			...conversation.slice(0, 3),
			reply("a2", 1_000, {
				contextTokens,
				contextEstimate: 7_000,
			}),
			user("u3", 1_000),
		];

		test("counts the history as the provider counted it, and what is new by estimate", () => {
			// 4 000 counted plus 1 000 new fits, though the estimate alone is 9 000.
			const result = fit(recorded(4_000), {
				contextWindow: 5_000,
			});

			// A step's messages may grow by the estimate as far as the calibrated budget allows.
			expect(result.fits && result.stepTokens).toBe(9_000);
			expect(keptIds(result)).toEqual([
				"u1",
				"a1",
				"u2",
				"a2",
				"u3",
			]);
		});

		test("trims when the provider counted more than the estimate", () => {
			// Counted twice the estimate: 17 000 in all, 9 000 once u1 and a1 are gone.
			const result = fit(recorded(16_000), {
				contextWindow: 12_000,
			});

			expect(keptIds(result)).toEqual([
				"u2",
				"a2",
				"u3",
			]);
			// The recorded estimate stays uncalibrated, so the next reply can calibrate it.
			expect(result.fits && result.estimate).toBe(5_000);
		});
	});

	test("a continued reply is left out of its own estimate", () => {
		const result = fit(
			[
				user("u1", 1_000),
				reply("a1", 2_000),
			],
			{
				replyId: "a1",
			},
		);

		expect(result.fits && result.estimate).toBe(1_000);
	});

	describe("after a compaction", () => {
		const partTypes = (result: ReturnType<typeof fit>) =>
			result.fits
				? result.messages.map(({ id, parts }) => [
						id,
						parts.map((part) => part.type),
					])
				: "refused";

		test("an Anthropic compaction block starts the prompt, in its reply", () => {
			const result = fit([
				...conversation.slice(0, 4),
				user("u3", 1_000),
				anthropicCompaction("a3", "The story so far."),
				user("u4", 100),
			]);

			expect(partTypes(result)).toEqual([
				[
					"a3",
					[
						"text",
						"text",
					],
				],
				[
					"u4",
					[
						"text",
					],
				],
			]);
		});

		test("an OpenAI compaction item starts the prompt for the openai kind, and is left out elsewhere", () => {
			const messages = [
				...conversation.slice(0, 4),
				openAICompaction("a3"),
				user("u4", 100),
			];

			expect(
				keptIds(
					fit(messages, {
						compaction: providerCompaction("openai", 100_000),
					}),
				),
			).toEqual([
				"a3",
				"u4",
			]);
			expect(partTypes(fit(messages)).slice(-2)).toEqual([
				[
					"a3",
					[
						"text",
					],
				],
				[
					"u4",
					[
						"text",
					],
				],
			]);
		});

		test("our own summary goes ahead of the turn it was written in, as a user message", () => {
			const result = fit(
				[
					...conversation.slice(0, 4),
					user("u3", 1_000),
					summarized("a3", "The story so far."),
					user("u4", 100),
				],
				{
					compaction: ownSummary,
				},
			);

			expect(result.fits && result.messages).toEqual([
				{
					id: "a3-summary",
					role: "user",
					parts: [
						{
							type: "text",
							text: `${SUMMARY_PREFIX}The story so far.`,
						},
					],
				},
				user("u3", 1_000),
				reply("a3", 500),
				user("u4", 100),
			]);
		});

		test("calibrates by the replies after it, not by the one that compacted", () => {
			const recorded = (id: string, tokens: number) =>
				reply(id, 1_000, {
					contextTokens: tokens,
					contextEstimate: 1_000,
				});
			const compacting = {
				...anthropicCompaction("a3", "The story so far."),
				metadata: {
					contextTokens: 50_000,
					contextEstimate: 1_000,
				},
			};

			// Counted as estimated after the compaction; the compacting reply counted its summary too.
			expect(
				keptIds(
					fit(
						[
							user("u1", 1_000),
							compacting,
							user("u2", 1_000),
							recorded("a2", 2_000),
							user("u3", 1_000),
						],
						{
							contextWindow: 6_000,
						},
					),
				),
			).toEqual([
				"a3",
				"u2",
				"a2",
				"u3",
			]);
		});
		test("our own summary's reply calibrates the prompt that starts at it", () => {
			// a2 counted half its estimate: 1 755 in all, where the estimate alone is 2 510.
			const result = fit(
				[
					user("u1", 1_000),
					reply("a1", 1_000),
					user("u2", 1_000),
					{
						...summarized("a2", "The story so far."),
						metadata: {
							contextTokens: 1_000,
							contextEstimate: 1_500,
						},
					},
					user("u3", 1_000),
				],
				{
					contextWindow: 2_000,
					compaction: ownSummary,
				},
			);

			expect(keptIds(result)).toEqual([
				"a2-summary",
				"u2",
				"a2",
				"u3",
			]);
			expect(result.fits && result.trimmed).toBe(false);
		});

		test("calibrates the request by a reply before it until one follows", () => {
			// a1 counted half its estimate, which the request keeps: 4 000 of it, not 8 000, fit beside the rest.
			const result = fit(
				[
					user("u1", 1_000),
					reply("a1", 1_000, {
						contextTokens: 1_500,
						contextEstimate: 2_000,
					}),
					user("u2", 1_000),
					anthropicCompaction("a2", "The story so far."),
					user("u3", 1_000),
				],
				{
					requestTokens: 8_000,
					contextWindow: 6_000,
				},
			);

			expect(keptIds(result)).toEqual([
				"a2",
				"u3",
			]);
			expect(result.fits && result.trimmed).toBe(false);
		});
	});

	describe("without native compaction", () => {
		test("hands all but the latest turn to our own summary at 80% of the budget", () => {
			const below = fit(conversation, {
				contextWindow: 11_250,
				compaction: ownSummary,
			});
			const above = fit(conversation, {
				contextWindow: 11_000,
				compaction: ownSummary,
			});

			expect(compactionTrigger(11_250)).toBe(9_000);
			expect(below.fits && below.summarize).toBeUndefined();
			expect(above.fits && above.summarize?.map(({ id }) => id)).toEqual([
				"u1",
				"a1",
				"u2",
				"a2",
			]);
			// Without the summary, the prompt goes as it fits.
			expect(keptIds(above)).toEqual(conversation.map(({ id }) => id));
		});

		test("summarizes only the newest turns one request can carry", () => {
			const result = fit(conversation, {
				contextWindow: 7_000,
				compaction: ownSummary,
			});

			expect(result.fits && result.summarize?.map(({ id }) => id)).toEqual([
				"u2",
				"a2",
			]);
		});

		test("trims the prompt to send without a summary once it outgrows the budget", () => {
			const result = fit(conversation, {
				contextWindow: 7_000,
				compaction: ownSummary,
			});

			expect(result.fits && result.summarize).toHaveLength(2);
			expect(result.fits && result.trimmed).toBe(true);
		});

		test("has nothing to summarize in a latest turn alone, or in a summary alone before it", () => {
			const alone = fit(
				[
					user("u1", 9_500),
				],
				{
					compaction: ownSummary,
				},
			);
			const afterSummary = fit(
				[
					...conversation.slice(0, 4),
					user("u3", 8_000),
					summarized("a3", "The story so far."),
				],
				{
					compaction: ownSummary,
					replyId: "a3",
				},
			);

			expect(alone.fits && alone.summarize).toBeUndefined();
			expect(afterSummary.fits && afterSummary.summarize).toBeUndefined();
		});

		test("native compaction never asks for our own", () => {
			const result = fit(conversation, {
				contextWindow: 9_000,
			});

			expect(result.fits && result.summarize).toBeUndefined();
		});
	});
});
