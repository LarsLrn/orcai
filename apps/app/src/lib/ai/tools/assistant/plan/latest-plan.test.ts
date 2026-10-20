import { describe, expect, test } from "bun:test";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import {
	isPlanPart,
	isPlanUpdating,
	latestPlanPart,
	pendingPlanApprovalIds,
} from "./latest-plan";

type MessagePart = ChatAgentUIMessage["parts"][number];

const planPart = (
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
	}) as unknown as MessagePart;

const text = (content: string) =>
	({
		type: "text",
		text: content,
		state: "done",
	}) as unknown as MessagePart;

const message = (...parts: MessagePart[]) => ({
	parts,
});

const latest = (...messages: ReturnType<typeof message>[]) =>
	latestPlanPart(messages) as MessagePart | undefined;

describe("latestPlanPart", () => {
	test("finds no plan in a conversation without one", () => {
		expect(latest(message(text("hi")))).toBeUndefined();
	});

	test("takes the newest plan across messages", () => {
		const newest = planPart("Second", "output-available");

		expect(
			latest(
				message(planPart("First", "output-available")),
				message(text("hi")),
				message(newest),
			),
		).toBe(newest);
	});

	test("takes the newest plan within a message", () => {
		const newest = planPart("Second", "output-available");

		expect(
			latest(
				message(
					planPart("First", "output-available"),
					text("working"),
					newest,
					text("done"),
				),
			),
		).toBe(newest);
	});

	test.each([
		[
			"waiting for approval",
			planPart("Second", "approval-requested", {
				id: "approval-1",
			}),
		],
		[
			"approved but not run",
			planPart("Second", "approval-responded", {
				id: "approval-1",
				approved: true,
			}),
		],
	])("shows a plan %s", (_, part) => {
		expect(
			latest(message(planPart("First", "output-available")), message(part)),
		).toBe(part);
	});

	test.each([
		[
			"a streaming input",
			planPart("Second", "input-streaming"),
		],
		[
			"a complete input",
			planPart("Second", "input-available"),
		],
		[
			"a failed call",
			planPart("Second", "output-error"),
		],
		[
			"a denied plan",
			planPart("Second", "output-denied", {
				id: "approval-1",
				approved: false,
			}),
		],
		[
			"a rejected approval",
			planPart("Second", "approval-responded", {
				id: "approval-1",
				approved: false,
			}),
		],
	])("skips %s for the plan before it", (_, part) => {
		const earlier = planPart("First", "output-available");

		expect(latest(message(earlier), message(part))).toBe(earlier);
	});
});

describe("superseded proposals", () => {
	test("a proposal before a later message no longer shows", () => {
		const earlier = planPart("First", "output-available");

		expect(
			latest(
				message(earlier),
				message(
					planPart("Second", "approval-requested", {
						id: "approval-1",
					}),
				),
				message(text("Do something else")),
			),
		).toBe(earlier);
	});
});

describe("pendingPlanApprovalIds", () => {
	test("lists the reply's proposals waiting for approval", () => {
		expect(
			pendingPlanApprovalIds(
				message(
					planPart("First", "output-available"),
					planPart("Second", "approval-requested", {
						id: "approval-2",
					}),
				),
			),
		).toEqual([
			"approval-2",
		]);
	});
});

describe("isPlanUpdating", () => {
	test("is true while the reply's newest plan call is arriving or running", () => {
		expect(
			isPlanUpdating(
				message(
					planPart("First", "output-available"),
					planPart("Second", "input-streaming"),
				),
			),
		).toBe(true);
		expect(
			isPlanUpdating(
				message(
					planPart("First", "input-available"),
					planPart("Second", "output-available"),
				),
			),
		).toBe(false);
	});
});

describe("isPlanPart", () => {
	test("matches updatePlan parts only", () => {
		expect(isPlanPart(planPart("First", "output-available"))).toBe(true);
		expect(isPlanPart(text("hi"))).toBe(false);
	});
});
