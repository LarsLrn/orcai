import { describe, expect, test } from "bun:test";
import { classifyTurn, type MessagePart, pausedStep } from "./classify-turn";

const text = (content: string) =>
	({
		type: "text",
		text: content,
		state: "done",
	}) as unknown as MessagePart;

const reasoning = (content: string, state = "done") =>
	({
		type: "reasoning",
		text: content,
		state,
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

const checklist = (state = "output-available") =>
	({
		type: "tool-showChecklist",
		toolCallId: `checklist-${state}`,
		state,
		input: {
			items: [],
		},
	}) as unknown as MessagePart;

const stepStart = () =>
	({
		type: "step-start",
	}) as unknown as MessagePart;

const deleteBot = (state: string, approved?: boolean) =>
	({
		type: "tool-deleteBot",
		toolCallId: `delete-${state}-${approved}`,
		state,
		input: {
			ids: [
				"bot-1",
			],
		},
		...(state === "output-available"
			? {
					output: {
						deleted: [],
						skipped: [],
					},
				}
			: {}),
		approval: {
			id: `approval-${state}`,
			...(approved === undefined
				? {}
				: {
						approved,
					}),
		},
	}) as unknown as MessagePart;

describe("classifyTurn", () => {
	test("finished reasoning without text stays out of the work log", () => {
		const turn = classifyTurn(
			[
				reasoning(""),
				reasoning("", "streaming"),
				search(),
				text("answer"),
			],
			{
				running: true,
			},
		);

		expect(turn.entries.map((entry) => entry.id)).toEqual([
			"1",
			"2",
		]);
	});

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

	test("text right before a working tool call is progress", () => {
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
			"reasoning",
		]);
		expect(turn.answerParts).toEqual([
			text("found it"),
			text("answer"),
		]);
	});

	test("reasoning and text between text and a tool call keep it progress", () => {
		const turn = classifyTurn([
			text("first"),
			reasoning("a"),
			text("second"),
			search(),
			text("answer"),
		]);

		expect(
			turn.entries.map((entry) => [
				entry.kind,
				entry.id,
			]),
		).toEqual([
			[
				"text",
				"0",
			],
			[
				"reasoning",
				"1",
			],
			[
				"text",
				"2",
			],
			[
				"tool",
				"3",
			],
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

	test("a running turn ending on a tool call has no answer yet", () => {
		const turn = classifyTurn(
			[
				text("let me look"),
				search(),
			],
			{
				running: true,
			},
		);

		expect(turn.entries.map((entry) => entry.kind)).toEqual([
			"text",
			"tool",
		]);
		expect(turn.answerParts).toEqual([]);
	});

	test("a finished turn without an answer shows its last text", () => {
		const turn = classifyTurn([
			text("let me look"),
			search(),
			text("looking again"),
			search(),
		]);

		expect(turn.entries.map((entry) => entry.kind)).toEqual([
			"text",
			"tool",
			"tool",
		]);
		expect(turn.answerParts).toEqual([
			text("looking again"),
		]);
	});

	test("a finished turn without any text has no answer", () => {
		const turn = classifyTurn([
			reasoning("a"),
			search(),
		]);

		expect(turn.entries).toHaveLength(2);
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

	test("display parts land in the answer in stream order", () => {
		const turn = classifyTurn([
			search(),
			reasoning("a"),
			checklist("input-streaming"),
			search(),
			reasoning("b"),
			text("checking more"),
			reasoning("c"),
			search(),
			checklist(),
			text("answer"),
		]);

		expect(
			turn.entries.map((entry) => [
				entry.kind,
				entry.id,
			]),
		).toEqual([
			[
				"tool",
				"0",
			],
			[
				"reasoning",
				"1",
			],
			[
				"tool",
				"3",
			],
			[
				"reasoning",
				"4",
			],
			[
				"text",
				"5",
			],
			[
				"reasoning",
				"6",
			],
			[
				"tool",
				"7",
			],
		]);
		expect(turn.answerParts).toEqual([
			checklist("input-streaming"),
			checklist(),
			text("answer"),
		]);
	});

	test("text around a display part stays in the answer", () => {
		const turn = classifyTurn([
			text("lead-in"),
			checklist(),
			text("conclusion"),
		]);

		expect(turn.entries).toEqual([]);
		expect(turn.answerParts).toEqual([
			text("lead-in"),
			checklist(),
			text("conclusion"),
		]);
	});

	test("a failed display part is a work-log tool entry", () => {
		const turn = classifyTurn([
			search(),
			text("lead-in"),
			checklist("output-error"),
			text("answer"),
		]);

		expect(
			turn.entries.map((entry) => [
				entry.kind,
				entry.part.type,
			]),
		).toEqual([
			[
				"tool",
				"tool-searchKnowledgeBase",
			],
			[
				"tool",
				"tool-showChecklist",
			],
		]);
		expect(turn.answerParts).toEqual([
			text("lead-in"),
			text("answer"),
		]);
	});
});

describe("paused step", () => {
	const pausedTurn = (state: string, approved?: boolean) => [
		stepStart(),
		text("let me look"),
		search(),
		stepStart(),
		text("I will delete it"),
		search(),
		deleteBot(state, approved),
	];

	test("a requested approval puts the step's text and card in the answer", () => {
		const parts = pausedTurn("approval-requested");
		const turn = classifyTurn(parts);

		expect(
			turn.entries.map((entry) => [
				entry.id,
				entry.kind,
			]),
		).toEqual([
			[
				"1",
				"text",
			],
			[
				"2",
				"tool",
			],
			[
				"5",
				"tool",
			],
		]);
		expect(turn.answerParts).toEqual([
			text("I will delete it"),
			deleteBot("approval-requested"),
		]);
		expect(pausedStep(parts, false)).toEqual({
			start: 4,
			answered: false,
		});
	});

	test("an answered step that has not run stays in the answer", () => {
		const parts = pausedTurn("approval-responded", true);
		const turn = classifyTurn(parts);

		expect(turn.answerParts).toEqual([
			text("I will delete it"),
			deleteBot("approval-responded", true),
		]);
		expect(pausedStep(parts, false)?.answered).toBe(true);
	});

	test("a partly answered step is not answered", () => {
		const parts = [
			...pausedTurn("approval-responded", true),
			deleteBot("approval-requested"),
		];

		expect(pausedStep(parts, false)?.answered).toBe(false);
	});

	test("while streaming the normal rule applies", () => {
		const parts = pausedTurn("approval-responded", true);

		expect(pausedStep(parts, true)).toBeUndefined();
		expect(
			classifyTurn(parts, {
				running: true,
			}).answerParts,
		).toEqual([]);
	});

	test("once resumed the card folds into the work log", () => {
		const turn = classifyTurn([
			...pausedTurn("output-available", true),
			stepStart(),
			text("Deleted."),
		]);

		expect(turn.entries.map((entry) => entry.part.type)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
			"text",
			"tool-searchKnowledgeBase",
			"tool-deleteBot",
		]);
		expect(turn.answerParts).toEqual([
			text("Deleted."),
		]);
	});

	test("an earlier step's approval does not pause the turn", () => {
		const parts = [
			stepStart(),
			deleteBot("approval-requested"),
			stepStart(),
			text("answer"),
		];

		expect(pausedStep(parts, false)).toBeUndefined();
	});
});
