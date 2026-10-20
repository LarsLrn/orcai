import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { pruneAssistantHistory } from "./assistant-history-pruning";

const user = (text: string): ModelMessage => ({
	role: "user",
	content: text,
});

const call = (
	toolName: string,
	id: string,
	output: Extract<
		ModelMessage,
		{
			role: "tool";
		}
	>["content"][number] = {
		type: "tool-result",
		toolCallId: id,
		toolName,
		output: {
			type: "json",
			value: {
				full: true,
			},
		},
	},
): ModelMessage[] => [
	{
		role: "assistant",
		content: [
			{
				type: "tool-call",
				toolCallId: id,
				toolName,
				input: {
					query: id,
				},
			},
		],
	},
	{
		role: "tool",
		content: [
			output,
		],
	},
];

const outputsOf = (messages: ModelMessage[]) =>
	Object.fromEntries(
		messages.flatMap((message) =>
			message.role === "tool"
				? message.content.map((part) =>
						part.type === "tool-result"
							? [
									part.toolCallId,
									part.output,
								]
							: [
									part.approvalId,
									part.type,
								],
					)
				: [],
		),
	);

const prune = (
	messages: ModelMessage[],
	enabledDisplayToolNames = [],
	toolListChanges = true,
) =>
	pruneAssistantHistory(messages, {
		lines: new Map([
			[
				"a",
				"Found 3 bots",
			],
			[
				"b",
				"Read the docs page “Bots” (/docs/using-orcai/bots)",
			],
		]),
		displayToolNames: [
			"showChecklist",
		],
		enabledDisplayToolNames,
		toolListChanges,
	});

const full = {
	type: "json",
	value: {
		full: true,
	},
};

const reasoning = (text: string) => ({
	type: "reasoning" as const,
	text,
	providerOptions: {
		anthropic: {
			signature: `signed ${text}`,
		},
	},
});

const thought = (text: string, messages: ModelMessage[]): ModelMessage[] =>
	messages.map((message) =>
		message.role === "assistant" && Array.isArray(message.content)
			? {
					...message,
					content: [
						reasoning(text),
						...message.content,
					],
				}
			: message,
	);

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

describe("pruneAssistantHistory", () => {
	test("replaces outputs of finished turns with their summary line", () => {
		const outputs = outputsOf(
			prune([
				user("hi"),
				...call("findBots", "a"),
				user("and the docs?"),
				...call("readDocs", "b"),
				user("and that bot?"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
		expect(outputs.b).toEqual({
			type: "text",
			value: "Read the docs page “Bots” (/docs/using-orcai/bots)",
		});
		expect(outputs.c).toEqual({
			type: "json",
			value: {
				full: true,
			},
		});
	});

	test("keeps the tool references of a summarised output", () => {
		const reference = {
			type: "custom" as const,
			providerOptions: {
				anthropic: {
					type: "tool-reference",
					toolName: "updateBot",
				},
			},
		};
		const outputs = outputsOf(
			prune([
				user("hi"),
				...call("loadTools", "a", {
					type: "tool-result",
					toolCallId: "a",
					toolName: "loadTools",
					output: {
						type: "content",
						value: [
							{
								type: "text",
								text: "{}",
							},
							reference,
						],
					},
				}),
				user("go on"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "content",
			value: [
				{
					type: "text",
					text: "Found 3 bots",
				},
				reference,
			],
		});
	});

	test("keeps every tool call and its input", () => {
		const pruned = prune([
			...call("findBots", "a"),
			...call("getBot", "c"),
		]);

		expect(
			pruned.flatMap((message) =>
				message.role === "assistant" && Array.isArray(message.content)
					? message.content
					: [],
			),
		).toEqual([
			{
				type: "tool-call",
				toolCallId: "a",
				toolName: "findBots",
				input: {
					query: "a",
				},
			},
			{
				type: "tool-call",
				toolCallId: "c",
				toolName: "getBot",
				input: {
					query: "c",
				},
			},
		]);
	});

	test("keeps the newest plan whole while its output becomes the summary line", () => {
		const plan = {
			title: "Set up the course",
			items: [
				{
					label: "Create the bot",
					status: "done",
				},
				{
					label: "Share it",
					status: "pending",
				},
			],
		};
		const planCall: ModelMessage = {
			role: "assistant",
			content: [
				{
					type: "tool-call",
					toolCallId: "p",
					toolName: "updatePlan",
					input: plan,
				},
			],
		};
		const pruned = pruneAssistantHistory(
			[
				planCall,
				{
					role: "tool",
					content: [
						{
							type: "tool-result",
							toolCallId: "p",
							toolName: "updatePlan",
							output: {
								type: "json",
								value: {
									updated: true,
								},
							},
						},
					],
				},
				user("go on"),
				...call("getBot", "c"),
			],
			{
				lines: new Map([
					[
						"p",
						"Plan “Set up the course”: 1 of 2 done",
					],
				]),
				displayToolNames: [],
				enabledDisplayToolNames: [],
				toolListChanges: true,
			},
		);

		expect(pruned[0]).toEqual(planCall);
		expect(outputsOf(pruned).p).toEqual({
			type: "text",
			value: "Plan “Set up the course”: 1 of 2 done",
		});
	});

	test("keeps every output of the turn in progress", () => {
		const outputs = outputsOf(
			prune([
				user("hi"),
				...call("findBots", "a"),
				user("and that bot?"),
				...call("readDocs", "b"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
		expect(outputs.b).toEqual(full);
		expect(outputs.c).toEqual(full);
	});

	test("summarises every output once the latest assistant message is text", () => {
		const outputs = outputsOf(
			prune([
				...call("findBots", "a"),
				{
					role: "assistant",
					content: "You have three bots.",
				},
				user("Thanks"),
			]),
		);

		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
	});

	test("leaves errors, denials and approval responses untouched", () => {
		const error = {
			type: "tool-result",
			toolCallId: "e",
			toolName: "deleteBot",
			output: {
				type: "error-text",
				value: "FORBIDDEN: no",
			},
		} as const;
		const denied = {
			type: "tool-result",
			toolCallId: "d",
			toolName: "deleteBot",
			output: {
				type: "execution-denied",
			},
		} as const;
		const approved: ModelMessage[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "a",
						toolName: "deleteBot",
						input: {},
					},
					{
						type: "tool-approval-request",
						approvalId: "approval",
						toolCallId: "a",
					},
				],
			},
			{
				role: "tool",
				content: [
					{
						type: "tool-approval-response",
						approvalId: "approval",
						approved: true,
					},
					{
						type: "tool-result",
						toolCallId: "a",
						toolName: "deleteBot",
						output: {
							type: "json",
							value: {
								full: true,
							},
						},
					},
				],
			},
		];
		const outputs = outputsOf(
			prune([
				...call("deleteBot", "e", error),
				...call("deleteBot", "d", denied),
				...approved,
				user("go on"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.e).toEqual(error.output);
		expect(outputs.d).toEqual(denied.output);
		expect(outputs.approval).toBe("tool-approval-response");
		expect(outputs.a).toEqual({
			type: "text",
			value: "Found 3 bots",
		});
	});

	test("falls back to a generic line for tools without one", () => {
		const outputs = outputsOf(
			prune([
				...call("mysteryTool", "x"),
				user("go on"),
				...call("getBot", "c"),
			]),
		);

		expect(outputs.x).toEqual({
			type: "text",
			value: "Called mysteryTool; its output is no longer available",
		});
	});

	test("keeps enabled display calls and drops disabled ones", () => {
		const messages = [
			...call("showChecklist", "s"),
			user("go on"),
			...call("getBot", "c"),
		];

		expect(outputsOf(prune(messages)).s).toBeUndefined();
		expect(
			outputsOf(
				pruneAssistantHistory(messages, {
					lines: new Map(),
					displayToolNames: [
						"showChecklist",
					],
					enabledDisplayToolNames: [
						"showChecklist",
					],
					toolListChanges: true,
				}),
			).s,
		).toEqual({
			type: "json",
			value: {
				full: true,
			},
		});
	});

	test("keeps reasoning only in the turn in progress", () => {
		const turn = [
			...thought("b", call("readDocs", "b")),
			...thought("c", call("getBot", "c")),
		];
		const pruned = prune([
			user("hi"),
			...thought("a", call("findBots", "a")),
			user("and the docs?"),
			...turn,
		]);

		expect(reasoningOf(pruned)).toEqual([
			"b",
			"c",
		]);
		expect(pruned.slice(-turn.length)).toEqual(turn);
	});

	test("drops the reasoning of a reply whose pending approval a new message closed", () => {
		const closed = thought(
			"plan",
			call("deleteBot", "d", {
				type: "tool-result",
				toolCallId: "d",
				toolName: "deleteBot",
				output: {
					type: "execution-denied",
					reason: "The user moved on.",
				},
			}),
		);

		expect(
			reasoningOf(
				prune([
					user("delete my bot"),
					...closed,
					user("take a step back"),
				]),
			),
		).toEqual([]);
	});

	test("keeps reasoning only from the turn's latest loadTools result on", () => {
		const pruned = prune([
			user("hi"),
			...thought("before", call("loadTools", "l")),
			...thought("after", call("getBot", "c")),
		]);

		expect(reasoningOf(pruned)).toEqual([
			"after",
		]);
	});

	test("keeps the turn's reasoning where loading leaves the tool list as it is", () => {
		const pruned = prune(
			[
				user("hi"),
				...thought("before", call("loadTools", "l")),
				...thought("after", call("getBot", "c")),
			],
			[],
			false,
		);

		expect(reasoningOf(pruned)).toEqual([
			"before",
			"after",
		]);
	});

	test("keeps reasoning only from an approved plan's result on", () => {
		const denied = thought(
			"denied",
			call("updatePlan", "d", {
				type: "tool-result",
				toolCallId: "d",
				toolName: "updatePlan",
				output: {
					type: "error-text",
					value: "Tool call execution denied.",
				},
			}),
		);
		const pruned = prune([
			user("plan it"),
			...thought("proposed", call("updatePlan", "p")),
			...denied,
			...thought("after", call("createBot", "c")),
		]);

		expect(reasoningOf(pruned)).toEqual([
			"denied",
			"after",
		]);
	});
});
