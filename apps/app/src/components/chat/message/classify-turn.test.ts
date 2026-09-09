import { describe, expect, test } from "bun:test";
import { classifyTurn, type MessagePart } from "./classify-turn";

const text = (content: string) =>
	({
		type: "text",
		text: content,
		state: "done",
	}) as unknown as MessagePart;

const reasoning = (content: string) =>
	({
		type: "reasoning",
		text: content,
		state: "done",
	}) as unknown as MessagePart;

const search = () =>
	({
		type: "tool-searchKnowledgeBase",
		toolCallId: "call-1",
		state: "output-available",
		input: {
			query: "x",
		},
		output: {
			results: [],
		},
	}) as unknown as MessagePart;

describe("classifyTurn", () => {
	test("text after the last step is the answer", () => {
		const turn = classifyTurn([
			reasoning("a"),
			search(),
			text("answer"),
		]);

		expect(turn.entries.map((entry) => entry.kind)).toEqual([
			"reasoning",
			"tool",
		]);
		expect(turn.answerParts).toEqual([
			text("answer"),
		]);
	});

	test("text before the last step is an intermediate response", () => {
		const turn = classifyTurn([
			text("let me look"),
			search(),
			text("found it"),
			reasoning("b"),
			text("answer"),
		]);

		expect(turn.entries.map((entry) => entry.kind)).toEqual([
			"text",
			"tool",
			"text",
			"reasoning",
		]);
		expect(turn.answerParts).toEqual([
			text("answer"),
		]);
	});

	test("a turn without steps is all answer", () => {
		const turn = classifyTurn([
			text("answer"),
		]);

		expect(turn.entries).toEqual([]);
		expect(turn.answerParts).toEqual([
			text("answer"),
		]);
	});

	test("a turn ending on a step has no answer", () => {
		const turn = classifyTurn([
			text("let me look"),
			search(),
		]);

		expect(turn.entries.map((entry) => entry.kind)).toEqual([
			"text",
			"tool",
		]);
		expect(turn.answerParts).toEqual([]);
	});

	test("blank intermediate text is dropped and entry ids follow part order", () => {
		const turn = classifyTurn([
			text("  "),
			search(),
			text("answer"),
		]);

		expect(
			turn.entries.map((entry) => [
				entry.id,
				entry.kind,
			]),
		).toEqual([
			[
				"1",
				"tool",
			],
		]);
	});

	test("step-start parts are ignored", () => {
		const turn = classifyTurn([
			{
				type: "step-start",
			} as unknown as MessagePart,
			search(),
			{
				type: "step-start",
			} as unknown as MessagePart,
			text("answer"),
		]);

		expect(turn.entries).toHaveLength(1);
		expect(turn.answerParts).toEqual([
			text("answer"),
		]);
	});
});
