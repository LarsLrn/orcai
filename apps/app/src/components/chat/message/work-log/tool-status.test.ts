import { describe, expect, test } from "bun:test";
import { m } from "@/paraglide/messages";
import { isFailedStatus, toolErrorMessage } from "./tool-status";

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
