import { beforeEach, describe, expect, test } from "bun:test";
import type { BotId } from "@orcai/core";
import { quota } from "@orcai/quota/testing";
import * as Effect from "effect/Effect";
import {
	answerSetup,
	assistantRow,
	chatRow,
	conversation,
} from "../../turn/test-turn";
import { TOOL_CLOSE_SENTENCES } from "../../utils/close-pending-tool-parts";
import { answers, resetProcedures } from "../assistant/test-procedures";
import {
	capitalsAnswers,
	capitalsQuiz,
	clarifyingAnswers,
	clarifyingRound,
} from "./fixtures";

const botId = crypto.randomUUID() as BotId;

/** A bot with these features, and the template every bot has. */
const answerBot = (features: Record<string, unknown>) => {
	answers["block.list"] = () =>
		Effect.succeed({
			data: [
				{
					id: crypto.randomUUID(),
					type: "template",
					config: {
						systemPrompt: "You are the bot.",
					},
				},
			],
		});
	answers["bot.find"] = () =>
		Effect.succeed({
			data: {
				id: botId,
				features,
			},
		});
};

beforeEach(() => {
	resetProcedures();
	quota.reset();
	answerSetup({
		providerKind: "anthropic",
		providerModelId: "claude-opus-5-5",
	});
	answerBot({
		questions: {},
	});
});

const botChat = () =>
	conversation(
		chatRow({
			botId,
		}),
		"anthropic",
	);

type Body = {
	tools?: {
		name: string;
	}[];
	messages: {
		role: string;
		content:
			| string
			| {
					type: string;
					content?: unknown;
					is_error?: boolean;
			  }[];
	}[];
};

const toolNames = (body: unknown) =>
	((body as Body).tools ?? []).map(({ name }) => name);

/** The tool results the request sends, as the model reads them. */
const toolResults = (body: unknown) =>
	(body as Body).messages.flatMap((message) =>
		typeof message.content === "string"
			? []
			: message.content.filter((part) => part.type === "tool_result"),
	);

const partOf = (parts: unknown[], type: string) =>
	parts.find(
		(part): part is Record<string, unknown> =>
			typeof part === "object" &&
			part !== null &&
			"type" in part &&
			part.type === type,
	);

/** A bot reply that asks `input` and waits; returns the chat and the call's id. */
const asked = async (input: unknown) => {
	const chat = await botChat();
	chat.script([
		{
			text: "A few questions first.",
			calls: [
				{
					name: "askUser",
					input,
				},
			],
		},
	]);
	await chat.send("Build me a bot");
	const reply = chat.messages().at(-1);
	const call = partOf(reply?.parts ?? [], "tool-askUser");
	return {
		chat,
		toolCallId: String(call?.toolCallId),
		state: call?.state,
	};
};

describe("questions in a bot chat", () => {
	test("are offered only with the feature on", async () => {
		const chat = await botChat();
		chat.script([
			{
				text: "Hi.",
			},
		]);
		await chat.send("Hi");
		expect(toolNames(chat.bodies[0])).toEqual([
			"askUser",
			"showQuizResult",
		]);

		answerBot({});
		const plain = await botChat();
		plain.script([
			{
				text: "Hi.",
			},
		]);
		await plain.send("Hi");
		expect(toolNames(plain.bodies[0])).toEqual([]);
	});

	test("pause the reply, then continue it with the answers", async () => {
		const { chat, toolCallId, state } = await asked(clarifyingRound);
		expect(state).toBe("input-available");

		chat.script([
			{
				text: "Thanks, a bot for alumni.",
			},
		]);
		await chat.answer([
			{
				toolCallId,
				output: clarifyingAnswers,
			},
		]);

		const messages = chat.messages();
		expect(messages).toHaveLength(2);
		const reply = messages[1]?.parts ?? [];
		expect(partOf(reply, "tool-askUser")).toMatchObject({
			state: "output-available",
			output: clarifyingAnswers,
		});
		expect(JSON.stringify(toolResults(chat.bodies[1]))).toContain(
			'\\"other\\":\\"Alumni\\"',
		);
	});

	test("refuse answers that do not match the output", async () => {
		const { chat, toolCallId } = await asked(clarifyingRound);

		await expect(
			chat.answer([
				{
					toolCallId,
					output: {
						status: "maybe",
					},
				},
			]),
		).rejects.toMatchObject({
			reason: "CHAT_TOOL_OUTPUT_INVALID",
		});
	});

	test("skipped questions tell the model the user declined", async () => {
		const { chat, toolCallId } = await asked(clarifyingRound);
		chat.script([
			{
				text: "Fine, I will assume defaults.",
			},
		]);

		await chat.answer([
			{
				toolCallId,
				output: {
					status: "skipped",
				},
			},
		]);

		expect(JSON.stringify(toolResults(chat.bodies[1]))).toContain(
			"The user skipped the questions.",
		);
	});

	test("a new message instead of answers declines them, and is the reply", async () => {
		const { chat } = await asked(clarifyingRound);
		chat.script([
			{
				text: "Understood.",
			},
		]);

		await chat.send("Just make it for students");

		const [, reply] = chat.messages();
		expect(partOf(reply?.parts ?? [], "tool-askUser")).toMatchObject({
			state: "output-error",
			errorText: TOOL_CLOSE_SENTENCES.declined,
		});
		expect(toolResults(chat.bodies[1])).toEqual([
			expect.objectContaining({
				is_error: true,
				content: TOOL_CLOSE_SENTENCES.declined,
			}),
		]);
	});

	test("a submitted quiz is graded with totals the model reads back", async () => {
		const { chat, toolCallId } = await asked(capitalsQuiz);
		chat.script([
			{
				calls: [
					{
						name: "showQuizResult",
						input: {
							results: [
								{
									question: 1,
									verdict: "correct",
								},
								{
									question: 2,
									verdict: "partly_correct",
									earned: 0.5,
									expected: "Berlin and Vienna",
								},
								{
									question: 3,
									verdict: "incorrect",
									expected: "Tokyo",
								},
							],
						},
					},
				],
			},
			{
				text: "You scored 1.5 of 4.",
			},
		]);

		await chat.answer([
			{
				toolCallId,
				output: capitalsAnswers,
			},
		]);

		const reply = chat.messages()[1]?.parts ?? [];
		expect(partOf(reply, "tool-showQuizResult")).toMatchObject({
			state: "output-available",
			output: {
				earned: 1.5,
				points: 4,
			},
		});
		expect(JSON.stringify(toolResults(chat.bodies[2]))).toContain(
			'\\"earned\\":1.5,\\"points\\":4',
		);
	});

	test("a grading that awards a blank answer fails for the model to fix", async () => {
		const { chat, toolCallId } = await asked(capitalsQuiz);
		chat.script([
			{
				calls: [
					{
						name: "showQuizResult",
						input: {
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
									verdict: "correct",
								},
							],
						},
					},
				],
			},
			{
				text: "Let me fix that.",
			},
		]);

		await chat.answer([
			{
				toolCallId,
				output: capitalsAnswers,
			},
		]);

		expect(toolResults(chat.bodies[2]).at(-1)).toMatchObject({
			is_error: true,
			content:
				"QUIZ_GRADING_INVALID: question 3 has no answer, so it is incorrect.",
		});
	});
});

describe("questions in the assistant", () => {
	test("are offered from the first step", async () => {
		const chat = await conversation(assistantRow(), "anthropic");
		chat.script([
			{
				text: "Hi.",
			},
		]);

		await chat.send("Hi");

		expect(toolNames(chat.bodies[0])).toEqual(
			expect.arrayContaining([
				"askUser",
				"showQuizResult",
			]),
		);
	});
});
