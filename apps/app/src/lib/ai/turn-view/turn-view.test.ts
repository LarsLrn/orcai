import { describe, expect, test } from "bun:test";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { TOOL_CLOSE_SENTENCES } from "@/lib/ai/utils/close-pending-tool-parts";
import { pausedStep } from "./paused-step";
import {
	type ChatPhase,
	type ClientToolPart,
	type MessagePart,
	type MessageView,
	type ReasoningPart,
	type TextPart,
	type ToolPart,
	turnView,
} from "./turn-view";

const text = (content: string) =>
	({
		type: "text",
		text: content,
		state: "done",
	}) as unknown as TextPart;

const streamingText = (content: string) =>
	({
		type: "text",
		text: content,
		state: "streaming",
	}) as unknown as TextPart;

const reasoning = (content: string, state = "done") =>
	({
		type: "reasoning",
		text: content,
		state,
	}) as unknown as ReasoningPart;

const search = (state = "output-available", extra: object = {}) =>
	({
		type: "tool-searchKnowledgeBase",
		toolCallId: "call-1",
		state,
		input: {
			query: "x",
		},
		...(state === "output-available"
			? {
					output: {
						results: [],
					},
				}
			: {}),
		...extra,
	}) as unknown as ToolPart;

const checklist = (state = "output-available") =>
	({
		type: "tool-showChecklist",
		toolCallId: `checklist-${state}`,
		state,
		input: {
			items: [],
		},
	}) as unknown as ToolPart;

const stepStart = () =>
	({
		type: "step-start",
	}) as unknown as MessagePart;

const deleteBot = (state: string, approved?: boolean, reason?: string) =>
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
			id: `approval-${state}-${approved}`,
			...(approved === undefined
				? {}
				: {
						approved,
					}),
			...(reason === undefined
				? {}
				: {
						reason,
					}),
		},
	}) as unknown as ToolPart;

const upload = (state: string, extra: object = {}) =>
	({
		type: "tool-requestUpload",
		toolCallId: "upload-1",
		state,
		input: {
			reason: "Upload the style guides",
		},
		...(state === "output-available"
			? {
					output: {
						status: "cancelled",
					},
				}
			: {}),
		...extra,
	}) as unknown as ClientToolPart;

const askUser = (state: string, extra: object = {}) =>
	({
		type: "tool-askUser",
		toolCallId: "ask-1",
		state,
		input: {
			mode: "regular",
			questions: [
				{
					type: "text",
					prompt: "Who is it for?",
				},
			],
		},
		...(state === "output-available"
			? {
					output: {
						status: "answered",
						answers: [
							{
								type: "text",
								text: "Students",
							},
						],
					},
				}
			: {}),
		...extra,
	}) as unknown as ClientToolPart;

const updatePlan = (
	title: string,
	state: string,
	approval?: Record<string, unknown>,
) =>
	({
		type: "tool-updatePlan",
		toolCallId: `plan-${title}-${state}`,
		state,
		input: {
			title,
			items: [
				{
					label: "Create the bot",
					status: "pending",
				},
			],
		},
		...(state === "output-available"
			? {
					output: {
						updated: true,
					},
				}
			: {}),
		...(state === "output-error"
			? {
					errorText: "Invalid input",
				}
			: {}),
		...(approval
			? {
					approval,
				}
			: {}),
	}) as unknown as ToolPart;

const reply = (
	parts: MessagePart[],
	metadata: {
		stepLimitReached?: boolean;
		contextTokens?: number;
	} = {},
	id = "reply",
) =>
	({
		id,
		role: "assistant",
		parts,
		metadata,
	}) as unknown as ChatAgentUIMessage;

const question = () =>
	({
		id: "question",
		role: "user",
		parts: [
			text("Do something else"),
		],
	}) as unknown as ChatAgentUIMessage;

/** The reply's view as the chat's latest message, or before a newer question. */
const view = (
	parts: MessagePart[],
	{
		phase = "idle",
		latest = true,
		metadata,
	}: {
		phase?: ChatPhase;
		latest?: boolean;
		metadata?: {
			stepLimitReached?: boolean;
		};
	} = {},
): MessageView =>
	turnView(
		latest
			? [
					reply(parts, metadata),
				]
			: [
					reply(parts, metadata),
					question(),
				],
		phase,
	).messages[0] as MessageView;

const streaming = (parts: MessagePart[]) =>
	view(parts, {
		phase: "streaming",
	});

const answerParts = (message: MessageView) =>
	message.answer.map((answer): MessagePart => answer.part);

const entryKinds = (message: MessageView) =>
	message.workLog.map((entry) => entry.kind);

const entryTypes = (message: MessageView) =>
	message.workLog.map((entry) => entry.part.type);

const toolStatuses = (message: MessageView) =>
	message.workLog.flatMap((entry) =>
		entry.kind === "tool"
			? [
					entry.status,
				]
			: [],
	);

describe("work log and answer", () => {
	test("finished reasoning without text stays out of the work log", () => {
		const message = streaming([
			reasoning(""),
			reasoning("", "streaming"),
			search(),
			text("answer"),
		]);

		expect(message.workLog.map((entry) => entry.id)).toEqual([
			"1",
			"2",
		]);
	});

	test("a finished turn drops blank reasoning that never closed", () => {
		const message = view([
			search(),
			reasoning("", "streaming"),
		]);

		expect(entryKinds(message)).toEqual([
			"tool",
		]);
		expect(message.answer).toEqual([]);
	});

	test("text after the last step is the answer", () => {
		const message = view([
			reasoning("a"),
			search(),
			text("answer"),
		]);

		expect(entryKinds(message)).toEqual([
			"reasoning",
			"tool",
		]);
		expect(answerParts(message)).toEqual([
			text("answer"),
		]);
	});

	test("text right before a working tool call is progress", () => {
		const message = view([
			text("let me look"),
			search(),
			text("found it"),
			reasoning("b"),
			text("answer"),
		]);

		expect(entryKinds(message)).toEqual([
			"text",
			"tool",
			"reasoning",
		]);
		expect(answerParts(message)).toEqual([
			text("found it"),
			text("answer"),
		]);
	});

	test("reasoning and text between text and a tool call keep it progress", () => {
		const message = view([
			text("first"),
			reasoning("a"),
			text("second"),
			search(),
			text("answer"),
		]);

		expect(
			message.workLog.map((entry) => [
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
		expect(answerParts(message)).toEqual([
			text("answer"),
		]);
	});

	test("a turn without steps is all answer", () => {
		const message = view([
			text("answer"),
		]);

		expect(message.workLog).toEqual([]);
		expect(message.answer).toEqual([
			{
				kind: "text",
				part: text("answer"),
			},
		]);
	});

	test("a running turn ending on a tool call has no answer yet", () => {
		const message = streaming([
			text("let me look"),
			search(),
		]);

		expect(entryKinds(message)).toEqual([
			"text",
			"tool",
		]);
		expect(message.answer).toEqual([]);
	});

	test("a finished turn without an answer shows its last text", () => {
		const message = view([
			text("let me look"),
			search(),
			text("looking again"),
			search(),
		]);

		expect(entryKinds(message)).toEqual([
			"text",
			"tool",
			"tool",
		]);
		expect(answerParts(message)).toEqual([
			text("looking again"),
		]);
	});

	test("a finished turn without any text has no answer", () => {
		const message = view([
			reasoning("a"),
			search(),
		]);

		expect(message.workLog).toHaveLength(2);
		expect(message.answer).toEqual([]);
	});

	test("blank intermediate text is dropped and entry ids follow part order", () => {
		const message = view([
			text("  "),
			search(),
			text("answer"),
		]);

		expect(
			message.workLog.map((entry) => [
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
		const message = view([
			stepStart(),
			search(),
			stepStart(),
			text("answer"),
		]);

		expect(message.workLog).toHaveLength(1);
		expect(answerParts(message)).toEqual([
			text("answer"),
		]);
	});

	test("display parts land in the answer in stream order", () => {
		const message = view([
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
			message.workLog.map((entry) => [
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
		expect(message.answer.map((answer) => answer.kind)).toEqual([
			"display",
			"display",
			"text",
		]);
		expect(answerParts(message)).toEqual([
			checklist("input-streaming"),
			checklist(),
			text("answer"),
		]);
	});

	test("text around a display part stays in the answer", () => {
		const message = view([
			text("lead-in"),
			checklist(),
			text("conclusion"),
		]);

		expect(message.workLog).toEqual([]);
		expect(answerParts(message)).toEqual([
			text("lead-in"),
			checklist(),
			text("conclusion"),
		]);
	});

	test("a failed display part is a work-log tool entry", () => {
		const message = view([
			search(),
			text("lead-in"),
			checklist("output-error"),
			text("answer"),
		]);

		expect(entryTypes(message)).toEqual([
			"tool-searchKnowledgeBase",
			"tool-showChecklist",
		]);
		expect(answerParts(message)).toEqual([
			text("lead-in"),
			text("answer"),
		]);
	});
});

describe("tool status", () => {
	test("a finished call has none and a closed call reads its code", () => {
		expect(
			toolStatuses(
				view([
					search(),
					search("output-error", {
						errorText: TOOL_CLOSE_SENTENCES.superseded,
					}),
					search("output-error", {
						errorText: TOOL_CLOSE_SENTENCES.interrupted,
					}),
					search("output-denied", {
						approval: {
							id: "approval-1",
							approved: false,
							reason: TOOL_CLOSE_SENTENCES.superseded,
						},
					}),
				]),
			),
		).toEqual([
			null,
			"skipped",
			"interrupted",
			"skipped",
		]);
	});

	test("keeps real errors and denials", () => {
		expect(
			toolStatuses(
				view([
					search("output-error", {
						errorText: "Boom",
					}),
					search("output-denied", {
						approval: {
							id: "approval-1",
							approved: false,
							reason: "Not now",
						},
					}),
				]),
			),
		).toEqual([
			"failed",
			"denied",
		]);
	});

	test("an unfinished call runs while its message streams, then was interrupted", () => {
		const parts = [
			search("input-available"),
		];

		expect(toolStatuses(streaming(parts))).toEqual([
			"running",
		]);
		expect(toolStatuses(view(parts))).toEqual([
			"interrupted",
		]);
		expect(
			toolStatuses(
				view(parts, {
					phase: "sending",
				}),
			),
		).toEqual([
			"interrupted",
		]);
	});

	test("an answered approval is denied, or approved until its message runs it", () => {
		expect(
			toolStatuses(
				streaming([
					deleteBot("approval-responded", false),
					deleteBot("approval-responded", true),
				]),
			),
		).toEqual([
			"denied",
			"running",
		]);
		expect(
			view([
				deleteBot("approval-responded", true),
			]).answer,
		).toMatchObject([
			{
				kind: "approval",
				status: "approved",
			},
		]);
	});

	test("a call waiting on the user waits on the latest message and was skipped on older ones", () => {
		const parts = [
			stepStart(),
			text("Please upload them here."),
			upload("input-available"),
			deleteBot("approval-requested"),
		];

		expect(view(parts).answer).toMatchObject([
			{
				kind: "text",
			},
			{
				kind: "client",
				status: "awaiting-input",
			},
			{
				kind: "approval",
				status: "awaiting-approval",
			},
		]);
		expect(
			view(parts, {
				latest: false,
			}),
		).toMatchObject({
			workLog: [
				{
					kind: "tool",
					status: "skipped",
				},
			],
			answer: [
				{
					kind: "text",
				},
				{
					kind: "approval",
					status: "skipped",
					answerable: false,
				},
			],
		});
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
		const message = view(parts);

		expect(
			message.workLog.map((entry) => [
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
		expect(message.answer).toEqual([
			{
				kind: "text",
				part: text("I will delete it"),
			},
			{
				kind: "approval",
				part: deleteBot("approval-requested"),
				status: "awaiting-approval",
				answerable: true,
			},
		]);
		expect(message.canContinue).toBe(false);
		expect(pausedStep(reply(parts))).toMatchObject({
			start: 4,
			approvals: [
				deleteBot("approval-requested"),
			],
			answered: false,
		});
	});

	test("an answered step that has not run stays in the answer and can continue", () => {
		const parts = pausedTurn("approval-responded", true);
		const message = view(parts);

		expect(answerParts(message)).toEqual([
			text("I will delete it"),
			deleteBot("approval-responded", true),
		]);
		expect(message.canContinue).toBe(true);
		expect(pausedStep(reply(parts))?.answered).toBe(true);
	});

	test("only an idle chat answers or continues", () => {
		expect(
			view(pausedTurn("approval-requested"), {
				phase: "sending",
			}).answer[1],
		).toMatchObject({
			answerable: false,
		});
		expect(
			view(pausedTurn("approval-requested"), {
				phase: "error",
			}).answer[1],
		).toMatchObject({
			answerable: true,
		});
		expect(
			view(pausedTurn("approval-responded", true), {
				phase: "sending",
			}).canContinue,
		).toBe(false);
	});

	test("a cut-off reply being stored is not answered", () => {
		expect(
			view(pausedTurn("approval-requested"), {
				phase: "storing",
			}).answer[1],
		).toMatchObject({
			answerable: false,
		});
		expect(
			view(pausedTurn("approval-responded", true), {
				phase: "storing",
			}).canContinue,
		).toBe(false);
	});

	test("a partly answered step is not answered", () => {
		const parts = [
			...pausedTurn("approval-responded", true),
			deleteBot("approval-requested"),
		];

		expect(pausedStep(reply(parts))?.answered).toBe(false);
		expect(view(parts).canContinue).toBe(false);
	});

	test("while streaming the normal rule applies", () => {
		const message = streaming(pausedTurn("approval-responded", true));

		expect(message.answer).toEqual([]);
		expect(message.canContinue).toBe(false);
	});

	test("once resumed the card folds into the work log", () => {
		const message = view([
			...pausedTurn("output-available", true),
			stepStart(),
			text("Deleted."),
		]);

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
			"text",
			"tool-searchKnowledgeBase",
			"tool-deleteBot",
		]);
		expect(answerParts(message)).toEqual([
			text("Deleted."),
		]);
	});

	test("a plan that ran is a work-log entry before the answer", () => {
		const message = view([
			stepStart(),
			updatePlan("Set up the course", "output-available"),
			stepStart(),
			text("Done."),
		]);

		expect(entryTypes(message)).toEqual([
			"tool-updatePlan",
		]);
		expect(answerParts(message)).toEqual([
			text("Done."),
		]);
	});

	test("a plan waiting for approval stays in the work log", () => {
		const parts = [
			stepStart(),
			text("let me look"),
			search(),
			stepStart(),
			text("Here is my plan."),
			updatePlan("Set up the course", "approval-requested", {
				id: "approval-plan",
			}),
		];
		const message = view(parts);

		expect(pausedStep(reply(parts))).toMatchObject({
			start: 4,
			answered: false,
		});
		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
			"tool-updatePlan",
		]);
		expect(toolStatuses(message).at(-1)).toBe("awaiting-approval");
		expect(answerParts(message)).toEqual([
			text("Here is my plan."),
		]);
	});

	test("an earlier step's approval does not pause the turn", () => {
		const parts = [
			stepStart(),
			deleteBot("approval-requested"),
			stepStart(),
			text("answer"),
		];

		expect(pausedStep(reply(parts))).toBeUndefined();
	});

	test("a finished server step does not pause the turn", () => {
		expect(
			pausedStep(
				reply([
					stepStart(),
					search(),
				]),
			),
		).toBeUndefined();
	});

	test("a question does not pause", () => {
		expect(pausedStep(question())).toBeUndefined();
	});

	test("holds the answers a continuation sends", () => {
		expect(
			pausedStep(
				reply([
					stepStart(),
					search(),
					deleteBot("approval-responded", false, "Not now"),
					deleteBot("approval-responded", true),
					upload("output-available"),
				]),
			)?.answers,
		).toEqual({
			approvals: [
				{
					approvalId: "approval-approval-responded-false",
					approved: false,
					reason: "Not now",
				},
				{
					approvalId: "approval-approval-responded-true",
					approved: true,
					reason: undefined,
				},
			],
			toolOutputs: [
				{
					toolCallId: "upload-1",
					output: {
						status: "cancelled",
					},
				},
			],
		});
	});
});

describe("client call step", () => {
	const widgetTurn = (state: string) => [
		stepStart(),
		text("let me look"),
		search(),
		stepStart(),
		text("Please upload them here."),
		upload(state),
	];

	test("a pending client call forms the answer boundary", () => {
		const parts = widgetTurn("input-available");
		const message = view(parts);

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
		]);
		expect(message.answer).toEqual([
			{
				kind: "text",
				part: text("Please upload them here."),
			},
			{
				kind: "client",
				part: upload("input-available"),
				status: "awaiting-input",
				answerable: true,
			},
		]);
		expect(pausedStep(reply(parts))).toMatchObject({
			start: 4,
			awaiting: [
				upload("input-available"),
			],
			answered: false,
		});
	});

	test("an answered call stays in the answer without a status", () => {
		expect(view(widgetTurn("output-available")).answer[1]).toEqual({
			kind: "client",
			part: upload("output-available"),
			status: null,
			answerable: false,
		});
	});

	test("a mixed step is answered once the call and the approval are", () => {
		const answered = (...parts: MessagePart[]) =>
			pausedStep(reply(parts))?.answered;

		expect(
			answered(
				...widgetTurn("output-available"),
				deleteBot("approval-requested"),
			),
		).toBe(false);
		expect(
			answered(
				...widgetTurn("input-available"),
				deleteBot("approval-responded", true),
			),
		).toBe(false);
		expect(
			answered(
				...widgetTurn("output-available"),
				deleteBot("approval-responded", true),
			),
		).toBe(true);
	});

	test("on an older message the call is a skipped work-log entry", () => {
		const message = view(widgetTurn("input-available"), {
			latest: false,
		});

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
			"tool-requestUpload",
		]);
		expect(toolStatuses(message).at(-1)).toBe("skipped");
		expect(answerParts(message)).toEqual([
			text("Please upload them here."),
		]);
	});

	test("a closed or half-streamed call waits on nobody", () => {
		const closed = [
			...widgetTurn("input-available").slice(0, -1),
			upload("output-error", {
				errorText: TOOL_CLOSE_SENTENCES.superseded,
			}),
		];
		const halfStreamed = widgetTurn("input-streaming");

		expect(pausedStep(reply(closed))).toBeUndefined();
		expect(pausedStep(reply(halfStreamed))).toBeUndefined();
		expect(view(closed).canContinue).toBe(false);
		expect(toolStatuses(view(closed)).at(-1)).toBe("skipped");
		expect(toolStatuses(view(halfStreamed)).at(-1)).toBe("interrupted");
	});

	test("a call that failed for its input waits on nobody", () => {
		const invalid = [
			...widgetTurn("input-available").slice(0, -1),
			upload("output-error", {
				errorText: "INVALID_TOOL_INPUT: Invalid input for tool requestUpload",
			}),
		];

		expect(pausedStep(reply(invalid))).toBeUndefined();
		expect(view(invalid).canContinue).toBe(false);
	});

	test("once resumed the call folds into the work log", () => {
		const message = view([
			...widgetTurn("output-available"),
			stepStart(),
			text("Done."),
		]);

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
			"text",
			"tool-requestUpload",
		]);
		expect(answerParts(message)).toEqual([
			text("Done."),
		]);
	});
});

describe("questions", () => {
	const askingTurn = (state: string, extra: object = {}) => [
		stepStart(),
		text("let me look"),
		search(),
		stepStart(),
		text("A few questions first."),
		askUser(state, extra),
	];

	test("waiting questions can be answered in the answer", () => {
		expect(view(askingTurn("input-available")).answer.at(-1)).toEqual({
			kind: "client",
			part: askUser("input-available"),
			status: "awaiting-input",
			answerable: true,
		});
	});

	test("once resumed the answered questions and their lead-in stay in the answer", () => {
		const message = view([
			...askingTurn("output-available"),
			stepStart(),
			text("Thanks, here is the plan."),
		]);

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
		]);
		expect(message.answer).toEqual([
			{
				kind: "text",
				part: text("A few questions first."),
			},
			{
				kind: "client",
				part: askUser("output-available"),
				status: null,
				answerable: false,
			},
			{
				kind: "text",
				part: text("Thanks, here is the plan."),
			},
		]);
	});

	test("questions a newer message declined stay in the answer as skipped", () => {
		const declined = askingTurn("output-error", {
			errorText: TOOL_CLOSE_SENTENCES.declined,
		});

		expect(pausedStep(reply(declined))).toBeUndefined();
		expect(view(declined).answer.at(-1)).toMatchObject({
			kind: "client",
			status: "skipped",
			answerable: false,
		});
		expect(
			view(askingTurn("input-available"), {
				latest: false,
			}).answer.at(-1),
		).toMatchObject({
			kind: "client",
			status: "skipped",
			answerable: false,
		});
	});

	test("questions still streaming are in the answer, not the work log", () => {
		const message = streaming(askingTurn("input-streaming"));

		expect(entryTypes(message)).toEqual([
			"text",
			"tool-searchKnowledgeBase",
		]);
		expect(message.answer.at(-1)).toMatchObject({
			kind: "client",
			status: "running",
		});
	});
});

describe("missing answer", () => {
	test("an empty reply waits for the model while it streams, and shows nothing before", () => {
		expect(streaming([]).missing).toBe("waiting");
		expect(
			view([], {
				phase: "sending",
			}).missing,
		).toBe("pending");
	});

	test("an empty reply that settled ended without an answer", () => {
		expect(view([]).missing).toBe("no-answer");
		expect(
			view([], {
				phase: "streaming",
				latest: false,
			}).missing,
		).toBe("no-answer");
	});

	test("a reply that ran out of steps stopped at the step limit", () => {
		expect(
			view(
				[
					search(),
				],
				{
					metadata: {
						stepLimitReached: true,
					},
				},
			).missing,
		).toBe("step-limit");
	});

	test("nothing stands in for a reply under way, an answer or a question", () => {
		expect(
			streaming([
				search(),
			]).missing,
		).toBeUndefined();
		expect(
			view([
				search(),
				text("answer"),
			]).missing,
		).toBeUndefined();
		expect(
			turnView(
				[
					question(),
				],
				"idle",
			).messages[0]?.missing,
		).toBe(undefined);
	});
});

describe("activity", () => {
	test("names the running tool call", () => {
		expect(
			streaming([
				search("input-available"),
			]).activity,
		).toEqual({
			kind: "tool",
			part: search("input-available"),
		});
	});

	test("is thinking while reasoning streams", () => {
		expect(
			streaming([
				search(),
				reasoning("a", "streaming"),
			]).activity,
		).toEqual({
			kind: "thinking",
		});
	});

	test("is working between steps", () => {
		expect(
			streaming([
				search(),
			]).activity,
		).toEqual({
			kind: "working",
		});
	});

	test("is unset while the answer streams and once the message stops", () => {
		expect(
			streaming([
				search(),
				streamingText("The answer"),
			]).activity,
		).toBeUndefined();
		expect(
			view([
				search("input-available"),
			]).activity,
		).toBeUndefined();
	});
});

describe("plan", () => {
	const planOf = (messages: MessagePart[][], phase: ChatPhase = "idle") =>
		turnView(
			messages.map((parts, index) => reply(parts, {}, `reply-${index}`)),
			phase,
		).plan;

	test("is unset in a conversation without one", () => {
		expect(
			planOf([
				[
					text("hi"),
				],
			]),
		).toBeUndefined();
	});

	test("takes the newest plan across and within messages", () => {
		const newest = updatePlan("Third", "output-available");

		expect(
			planOf([
				[
					updatePlan("First", "output-available"),
				],
				[
					updatePlan("Second", "output-available"),
					text("working"),
					newest,
					text("done"),
				],
			])?.part,
		).toBe(newest as never);
	});

	test.each([
		[
			"waiting for approval",
			updatePlan("Second", "approval-requested", {
				id: "approval-1",
			}),
		],
		[
			"approved but not run",
			updatePlan("Second", "approval-responded", {
				id: "approval-1",
				approved: true,
			}),
		],
	])("shows a plan %s", (_, part) => {
		expect(
			planOf([
				[
					updatePlan("First", "output-available"),
				],
				[
					part,
				],
			])?.part,
		).toBe(part as never);
	});

	test.each([
		[
			"a streaming input",
			updatePlan("Second", "input-streaming"),
		],
		[
			"a complete input",
			updatePlan("Second", "input-available"),
		],
		[
			"a failed call",
			updatePlan("Second", "output-error"),
		],
		[
			"a denied plan",
			updatePlan("Second", "output-denied", {
				id: "approval-1",
				approved: false,
			}),
		],
		[
			"a rejected approval",
			updatePlan("Second", "approval-responded", {
				id: "approval-1",
				approved: false,
			}),
		],
	])("skips %s for the plan before it", (_, part) => {
		const earlier = updatePlan("First", "output-available");

		expect(
			planOf([
				[
					earlier,
				],
				[
					part,
				],
			])?.part,
		).toBe(earlier as never);
	});

	test("a proposal before a later message no longer shows", () => {
		const earlier = updatePlan("First", "output-available");

		expect(
			turnView(
				[
					reply(
						[
							earlier,
						],
						{},
						"reply-0",
					),
					reply([
						updatePlan("Second", "approval-requested", {
							id: "approval-1",
						}),
					]),
					question(),
				],
				"idle",
			).plan?.part,
		).toBe(earlier as never);
	});

	test("lists the proposals the idle chat waits on", () => {
		const parts = [
			stepStart(),
			updatePlan("First", "approval-requested", {
				id: "approval-1",
			}),
			updatePlan("Second", "approval-requested", {
				id: "approval-2",
			}),
		];

		expect(
			planOf([
				parts,
			])?.approvalIds,
		).toEqual([
			"approval-1",
			"approval-2",
		]);
		expect(
			planOf(
				[
					parts,
				],
				"sending",
			)?.approvalIds,
		).toEqual([]);
	});

	test("is updating while the busy reply's newest plan call arrives or runs", () => {
		const updating = [
			updatePlan("First", "output-available"),
			updatePlan("Second", "input-streaming"),
		];

		expect(
			planOf(
				[
					updating,
				],
				"streaming",
			)?.updating,
		).toBe(true);
		expect(
			planOf(
				[
					[
						updatePlan("First", "input-available"),
						updatePlan("Second", "output-available"),
					],
				],
				"streaming",
			)?.updating,
		).toBe(false);
		expect(
			planOf([
				updating,
			])?.updating,
		).toBe(false);
	});
});

describe("compaction", () => {
	const summary = (content: string, state = "done") =>
		({
			type: "text",
			text: content,
			state,
			providerMetadata: {
				orcai: {
					type: "compaction",
				},
			},
		}) as unknown as TextPart;
	const anthropicCompaction = (content: string, state = "done") =>
		({
			type: "text",
			text: content,
			state,
			providerMetadata: {
				anthropic: {
					type: "compaction",
				},
			},
		}) as unknown as TextPart;
	const openAICompaction = () =>
		({
			type: "custom",
			kind: "openai.compaction",
			providerMetadata: {
				openai: {
					type: "compaction",
					itemId: "cmp_1",
					encryptedContent: "sealed",
				},
			},
		}) as unknown as MessagePart;
	const dividers = (
		messages: ChatAgentUIMessage[],
		phase: ChatPhase = "idle",
	) =>
		turnView(messages, phase).messages.map(
			({
				message,
				compactedBefore,
			}): [
				string,
				boolean,
			] => [
				message.id,
				compactedBefore,
			],
		);

	test("is the running activity while a summary streams", () => {
		for (const part of [
			summary("", "streaming"),
			anthropicCompaction("The story", "streaming"),
		]) {
			expect(
				streaming([
					part,
				]).activity,
			).toEqual({
				kind: "compacting",
			});
		}
	});

	test("stays out of the answer and the work log", () => {
		for (const part of [
			summary("The story so far."),
			anthropicCompaction("The story so far."),
			openAICompaction(),
		]) {
			const message = view([
				part,
				search(),
				text("The answer."),
			]);

			expect(answerParts(message)).toEqual([
				text("The answer."),
			]);
			expect(entryTypes(message)).toEqual([
				"tool-searchKnowledgeBase",
			]);
		}
		expect(
			answerParts(
				view([
					summary("The story so far."),
				]),
			),
		).toEqual([]);
	});

	test("a provider's compaction puts the divider above its reply", () => {
		expect(
			dividers([
				question(),
				reply([
					stepStart(),
					anthropicCompaction("The story so far."),
					text("Two."),
				]),
			]),
		).toEqual([
			[
				"question",
				false,
			],
			[
				"reply",
				true,
			],
		]);
	});

	test("our own summary puts the divider above the question it answered, once it is written", () => {
		const messages = (part: MessagePart) => [
			question(),
			reply([
				part,
				text("Two."),
			]),
		];

		expect(dividers(messages(summary("The story so far.")))).toEqual([
			[
				"question",
				true,
			],
			[
				"reply",
				false,
			],
		]);
		expect(dividers(messages(summary("", "streaming")), "streaming")).toEqual([
			[
				"question",
				false,
			],
			[
				"reply",
				false,
			],
		]);
		// A summary that failed stays empty.
		expect(dividers(messages(summary("")))[0]).toEqual([
			"question",
			false,
		]);
	});
});

describe("context", () => {
	test("is what the newest reply reporting it held", () => {
		expect(
			turnView(
				[
					reply(
						[
							text("First"),
						],
						{
							contextTokens: 1_200,
						},
						"first",
					),
					question(),
					reply(
						[
							text("Second"),
						],
						{
							contextTokens: 2_400,
						},
						"second",
					),
					question(),
					reply([], {}, "running"),
				],
				"streaming",
			).contextTokens,
		).toBe(2_400);
	});

	test("is unknown before any reply reports it", () => {
		expect(
			turnView(
				[
					question(),
				],
				"idle",
			).contextTokens,
		).toBeUndefined();
	});
});
