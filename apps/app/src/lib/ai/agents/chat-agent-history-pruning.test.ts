import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import {
	pruneChatHistory,
	pruneToolHistory,
} from "./chat-agent-history-pruning";

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

const contentToolNames = [
	"showChecklist",
	"showReview",
	"showMatrix",
];

// A Checklist turn, a repository turn, then a turn with every primitive.
const history: ModelMessage[] = [
	user("check it"),
	...call("showChecklist", "c1"),
	text("done 1"),
	user("look it up"),
	...call("searchRepositories", "s1"),
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
					contentToolNames,
					enabledContentToolNames: contentToolNames,
				}),
			),
		).toEqual(summarize(history));
	});

	test("removes disabled display calls with their results", () => {
		expect(
			summarize(
				pruneToolHistory(history, {
					contentToolNames,
					enabledContentToolNames: [],
				}),
			),
		).toEqual([
			"user check it",
			"assistant done 1",
			"user look it up",
			"call searchRepositories s1",
			"result searchRepositories s1",
			"assistant done 2",
			"user check again",
			"assistant done 3",
			"user and now?",
		]);
	});

	test("prunes repository calls before the latest one", () => {
		const messages = [
			user("first"),
			...call("searchRepositories", "s1"),
			text("one"),
			user("second"),
			...call("showChecklist", "c1"),
			...call("getPassages", "g1"),
			text("two"),
			user("third"),
			...call("showChecklist", "c2"),
			text("three"),
			user("fourth"),
		];

		expect(
			summarize(
				pruneToolHistory(messages, {
					contentToolNames,
					enabledContentToolNames: [
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
			"call getPassages g1",
			"result getPassages g1",
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
				contentToolNames,
				enabledContentToolNames: [],
			}),
		).toEqual(messages);
	});
});

describe("pruneChatHistory", () => {
	test("drops earlier turns' reasoning", () => {
		const thinking = (value: string): ModelMessage => ({
			role: "assistant",
			content: [
				{
					type: "reasoning",
					text: "thinking",
					providerOptions: {
						anthropic: {
							signature: "signed",
						},
					},
				},
				{
					type: "text",
					text: value,
				},
			],
		});

		expect(
			pruneChatHistory(
				[
					user("hi"),
					thinking("hello"),
					user("bye"),
				],
				{
					contentToolNames,
					enabledContentToolNames: [],
				},
			),
		).toEqual([
			user("hi"),
			text("hello"),
			user("bye"),
		]);
	});

	test("prunes finished turns and leaves the turn in progress as sent", () => {
		const turn = [
			...call("searchRepositories", "s2"),
			...call("showChecklist", "c2"),
			...call("getPassages", "g1"),
		];
		const options = {
			contentToolNames,
			enabledContentToolNames: [],
		};
		const pruned = pruneChatHistory(
			[
				user("first"),
				...call("searchRepositories", "s1"),
				...call("searchRepositories", "s0"),
				text("one"),
				user("second"),
				...turn,
			],
			options,
		);

		expect(summarize(pruned)).toEqual([
			"user first",
			"call searchRepositories s0",
			"result searchRepositories s0",
			"assistant one",
			"user second",
			...summarize(turn),
		]);
		expect(pruneChatHistory(pruned, options)).toEqual(pruned);
	});
});
