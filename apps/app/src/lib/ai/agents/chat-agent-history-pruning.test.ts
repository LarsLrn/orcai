import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { pruneToolHistory } from "./chat-agent-history-pruning";

const user = (text: string): ModelMessage => ({
	role: "user",
	content: text,
});

const text = (value: string): ModelMessage => ({
	role: "assistant",
	content: [
		{
			type: "text",
			text: value,
		},
	],
});

const call = (toolName: string, id: string): ModelMessage[] => [
	{
		role: "assistant",
		content: [
			{
				type: "tool-call",
				toolCallId: id,
				toolName,
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
				toolName,
				output: {
					type: "json",
					value: {
						ok: true,
					},
				},
			},
		],
	},
];

const summarize = (messages: ModelMessage[]) =>
	messages.flatMap((message) =>
		typeof message.content === "string"
			? [
					`${message.role} ${message.content}`,
				]
			: message.content.map((part) => {
					switch (part.type) {
						case "text":
							return `${message.role} ${part.text}`;
						case "tool-call":
							return `call ${part.toolName} ${part.toolCallId}`;
						case "tool-result":
							return `result ${part.toolName} ${part.toolCallId}`;
						default:
							return part.type;
					}
				}),
	);

const displayToolNames = [
	"showChecklist",
	"showReview",
	"showMatrix",
];

// A Checklist turn, a knowledge-base turn, then a turn with every primitive.
const history: ModelMessage[] = [
	user("check it"),
	...call("showChecklist", "c1"),
	text("done 1"),
	user("look it up"),
	...call("searchKnowledgeBase", "s1"),
	text("done 2"),
	user("check again"),
	...call("showChecklist", "c2"),
	...call("showReview", "r1"),
	...call("showMatrix", "m1"),
	text("done 3"),
	user("and now?"),
];

describe("pruneToolHistory", () => {
	test("keeps enabled display calls across turns and computes the boundary over other tools", () => {
		expect(
			summarize(
				pruneToolHistory(history, {
					displayToolNames,
					enabledDisplayToolNames: displayToolNames,
				}),
			),
		).toEqual(summarize(history));
	});

	test("removes disabled display calls with their results", () => {
		expect(
			summarize(
				pruneToolHistory(history, {
					displayToolNames,
					enabledDisplayToolNames: [],
				}),
			),
		).toEqual([
			"user check it",
			"assistant done 1",
			"user look it up",
			"call searchKnowledgeBase s1",
			"result searchKnowledgeBase s1",
			"assistant done 2",
			"user check again",
			"assistant done 3",
			"user and now?",
		]);
	});

	test("prunes knowledge-base calls before the latest one", () => {
		const messages = [
			user("first"),
			...call("searchKnowledgeBase", "s1"),
			text("one"),
			user("second"),
			...call("showChecklist", "c1"),
			...call("getKnowledgeBaseChunks", "g1"),
			text("two"),
			user("third"),
			...call("showChecklist", "c2"),
			text("three"),
			user("fourth"),
		];

		expect(
			summarize(
				pruneToolHistory(messages, {
					displayToolNames,
					enabledDisplayToolNames: [
						"showChecklist",
					],
				}),
			),
		).toEqual([
			"user first",
			"assistant one",
			"user second",
			"call showChecklist c1",
			"result showChecklist c1",
			"call getKnowledgeBaseChunks g1",
			"result getKnowledgeBaseChunks g1",
			"assistant two",
			"user third",
			"call showChecklist c2",
			"result showChecklist c2",
			"assistant three",
			"user fourth",
		]);
	});

	test("leaves a history without tool calls untouched", () => {
		const messages = [
			user("hi"),
			text("hello"),
			user("bye"),
		];

		expect(
			pruneToolHistory(messages, {
				displayToolNames,
				enabledDisplayToolNames: [],
			}),
		).toEqual(messages);
	});
});
