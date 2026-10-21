import { describe, expect, test } from "bun:test";
import type { ChatMessageMetadata } from "@orcai/schema";
import type { UIMessage } from "ai";
import { fitContextWindow } from "./context-window";

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

const fit = (
	messages: Message[],
	options: Partial<Parameters<typeof fitContextWindow>[0]> = {},
) =>
	fitContextWindow({
		messages,
		replyId: "next",
		requestTokens: 0,
		contextWindow: 10_000,
		reservedOutputTokens: 0,
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
			expect(
				keptIds(
					fit(recorded(4_000), {
						contextWindow: 5_000,
					}),
				),
			).toEqual([
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
});
