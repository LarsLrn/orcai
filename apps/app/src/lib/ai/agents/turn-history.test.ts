import { describe, expect, test } from "bun:test";
import { type ModelMessage, NoSuchToolError } from "ai";
import { AssistantToolError } from "@/lib/ai/tools/assistant/procedure-tool";
import {
	currentTurnStart,
	dropEarlierReasoning,
	withStoredToolFailures,
} from "./turn-history";

const user = (text: string): ModelMessage => ({
	role: "user",
	content: text,
});

const reasoning = (text: string) => ({
	type: "reasoning" as const,
	text,
	providerOptions: {
		anthropic: {
			signature: `signed ${text}`,
		},
	},
});

const step = (id: string): ModelMessage[] => [
	{
		role: "assistant",
		content: [
			reasoning(id),
			{
				type: "tool-call",
				toolCallId: id,
				toolName: "getBot",
				input: {},
			},
		],
	},
	{
		role: "tool",
		content: [
			{
				type: "tool-result",
				toolCallId: id,
				toolName: "getBot",
				output: {
					type: "json",
					value: {},
				},
			},
		],
	},
];

const reasoningOf = (messages: ModelMessage[]) =>
	messages.flatMap((message) =>
		message.role === "assistant" && Array.isArray(message.content)
			? message.content.flatMap((part) =>
					part.type === "reasoning"
						? [
								part.text,
							]
						: [],
				)
			: [],
	);

describe("currentTurnStart", () => {
	test("starts after the last user message", () => {
		expect(
			currentTurnStart([
				user("a"),
				...step("x"),
				user("b"),
				...step("y"),
			]),
		).toBe(4);
	});

	test("starts at the beginning without a user message", () => {
		expect(currentTurnStart(step("x"))).toBe(0);
	});
});

describe("dropEarlierReasoning", () => {
	test("drops finished turns' reasoning and keeps the turn in progress intact", () => {
		const turn = [
			...step("c"),
			...step("d"),
		];
		const dropped = dropEarlierReasoning([
			user("a"),
			...step("x"),
			{
				role: "assistant",
				content: [
					reasoning("y"),
					{
						type: "text",
						text: "Done.",
					},
				],
			},
			user("b"),
			...turn,
		]);

		expect(reasoningOf(dropped)).toEqual([
			"c",
			"d",
		]);
		expect(dropped.slice(-turn.length)).toEqual(turn);
	});

	test("removes assistant messages left empty", () => {
		expect(
			dropEarlierReasoning([
				user("a"),
				{
					role: "assistant",
					content: [
						reasoning("x"),
					],
				},
				user("b"),
			]),
		).toEqual([
			user("a"),
			user("b"),
		]);
	});

	test("drops reasoning before an explicit index inside the turn", () => {
		const messages = [
			user("a"),
			...step("x"),
			...step("y"),
		];

		expect(reasoningOf(dropEarlierReasoning(messages, 3))).toEqual([
			"y",
		]);
	});
});

describe("withStoredToolFailures", () => {
	const failed = (toolCallId: string, error: Error): ModelMessage => ({
		role: "tool",
		content: [
			{
				type: "tool-result",
				toolCallId,
				toolName: "getBot",
				output: {
					type: "error-text",
					value: error.toString(),
				},
			},
		],
	});
	const errorTexts = (messages: ModelMessage[]) =>
		messages.flatMap((message) =>
			message.role === "tool"
				? message.content.flatMap((part) =>
						part.type === "tool-result" && part.output.type === "error-text"
							? [
									part.output.value,
								]
							: [],
					)
				: [],
		);

	test("sends a failure as the reply stores it, not as the SDK prints it", () => {
		const toolError = new AssistantToolError("BOT_NOT_FOUND: No bot b-1.");
		const missing = new NoSuchToolError({
			toolName: "renameBot",
		});
		const messages = [
			failed("a", toolError),
			failed("b", missing),
			failed("c", new Error("not recorded")),
		];

		expect(
			errorTexts(
				withStoredToolFailures(messages, [
					{
						toolCallId: "a",
						error: toolError,
					},
					{
						toolCallId: "b",
						error: missing,
					},
				]),
			),
		).toEqual([
			"BOT_NOT_FOUND: No bot b-1.",
			"TOOL_NOT_AVAILABLE: There is no tool named renameBot in this conversation.",
			"Error: not recorded",
		]);
	});

	test("sends a denial as the reply stores it", () => {
		const denied: ModelMessage = {
			role: "tool",
			content: [
				{
					type: "tool-result",
					toolCallId: "d",
					toolName: "deleteBot",
					output: {
						type: "execution-denied",
					},
				},
			],
		};

		expect(
			errorTexts(
				withStoredToolFailures(
					[
						denied,
					],
					[],
				),
			),
		).toEqual([
			"Tool call execution denied.",
		]);
	});
});
