import { describe, expect, test } from "bun:test";
import type { ToolPart } from "@/components/chat/message/classify-turn";
import { TOOL_CLOSE_SENTENCES } from "@/lib/ai/utils/close-pending-tool-parts";
import { m } from "@/paraglide/messages";
import { isFailedStatus, toolErrorMessage, toolStatus } from "./tool-status";

const call = {
	type: "dynamic-tool",
	toolName: "search",
	toolCallId: "call-1",
	input: {},
} as const;

const failedWith = (errorText: string): ToolPart => ({
	...call,
	state: "output-error",
	errorText,
});

const deniedWith = (reason?: string): ToolPart => ({
	...call,
	state: "output-denied",
	approval: {
		id: "approval-1",
		approved: false,
		reason,
	},
});

describe("toolStatus", () => {
	test("reads a closed call's code from its sentence", () => {
		expect(toolStatus(failedWith(TOOL_CLOSE_SENTENCES.superseded), false)).toBe(
			"skipped",
		);
		expect(toolStatus(deniedWith(TOOL_CLOSE_SENTENCES.superseded), false)).toBe(
			"skipped",
		);
		expect(
			toolStatus(failedWith(TOOL_CLOSE_SENTENCES.interrupted), false),
		).toBe("interrupted");
	});

	test("keeps real errors and denials", () => {
		expect(toolStatus(failedWith("Boom"), false)).toBe("failed");
		expect(toolStatus(deniedWith(), false)).toBe("denied");
		expect(toolStatus(deniedWith("Not now"), false)).toBe("denied");
	});

	test("an unfinished call is running while the turn runs, then interrupted", () => {
		const pending: ToolPart = {
			...call,
			state: "input-available",
		};

		expect(toolStatus(pending, true)).toBe("running");
		expect(toolStatus(pending, false)).toBe("interrupted");
	});

	test("a requested approval awaits it and a result has no status", () => {
		expect(
			toolStatus(
				{
					...call,
					state: "approval-requested",
					approval: {
						id: "approval-1",
					},
				},
				false,
			),
		).toBe("awaiting-approval");
		expect(
			toolStatus(
				{
					...call,
					state: "output-available",
					output: "found",
				},
				false,
			),
		).toBeNull();
	});
});

describe("toolStatus for an answered approval", () => {
	const answered = (approved: boolean): ToolPart => ({
		...call,
		state: "approval-responded",
		approval: {
			id: "approval-1",
			approved,
		},
	});

	test("a denial is denied and an approval runs with the turn", () => {
		expect(toolStatus(answered(false), false)).toBe("denied");
		expect(toolStatus(answered(true), true)).toBe("running");
		expect(toolStatus(answered(true), false)).toBe("approved");
	});
});

describe("toolErrorMessage", () => {
	test("translates a leading reason code", () => {
		expect(
			toolErrorMessage(
				"PERMISSION_DENIED: You do not have permission to edit this bot.",
			),
		).toBe(m.error_permission_denied());
	});

	test("falls back to the generic failure for a reason with params", () => {
		expect(
			toolErrorMessage("BOT_REPOSITORY_EMPTY: Repository “X” is empty."),
		).toBe(m.error_ai_tool_failed());
	});

	test("leaves other texts alone", () => {
		expect(toolErrorMessage("Boom")).toBeUndefined();
		expect(toolErrorMessage("NOT_A_REASON: Boom")).toBeUndefined();
		expect(toolErrorMessage(undefined)).toBeUndefined();
	});
});

describe("isFailedStatus", () => {
	test("counts failures and denials, not skipped or interrupted calls", () => {
		expect(isFailedStatus("failed")).toBe(true);
		expect(isFailedStatus("denied")).toBe(true);
		expect(isFailedStatus("skipped")).toBe(false);
		expect(isFailedStatus("interrupted")).toBe(false);
	});
});
