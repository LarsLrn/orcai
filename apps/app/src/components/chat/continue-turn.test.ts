import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { shouldContinueTurn } from "./continue-turn";

type Part = UIMessage["parts"][number];

const reply = (...parts: Part[]) => ({
	messages: [
		{
			id: "question",
			role: "user",
			parts: [
				{
					type: "text",
					text: "Add my style guides",
				},
			],
		},
		{
			id: "reply",
			role: "assistant",
			parts: [
				{
					type: "step-start",
				},
				...parts,
			],
		},
	] satisfies UIMessage[],
});

const upload = (state: "input-available" | "output-available"): Part =>
	state === "input-available"
		? {
				type: "tool-requestUpload",
				toolCallId: "upload-1",
				state,
				input: {
					reason: "Upload the style guides",
				},
			}
		: {
				type: "tool-requestUpload",
				toolCallId: "upload-1",
				state,
				input: {
					reason: "Upload the style guides",
				},
				output: {
					status: "cancelled",
				},
			};

const deleteBot = (state: "approval-requested" | "approval-responded"): Part =>
	state === "approval-requested"
		? {
				type: "tool-deleteBot",
				toolCallId: "delete-1",
				state,
				input: {},
				approval: {
					id: "approval-1",
				},
			}
		: {
				type: "tool-deleteBot",
				toolCallId: "delete-1",
				state,
				input: {},
				approval: {
					id: "approval-1",
					approved: true,
				},
			};

const findBots: Part = {
	type: "tool-findBots",
	toolCallId: "find-1",
	state: "output-available",
	input: {},
	output: {
		bots: [],
	},
};

describe("shouldContinueTurn", () => {
	test("continues an answered widget step", () => {
		expect(shouldContinueTurn(reply(upload("output-available")))).toBe(true);
	});

	test("continues a step whose widget and approval are both answered", () => {
		expect(
			shouldContinueTurn(
				reply(upload("output-available"), deleteBot("approval-responded")),
			),
		).toBe(true);
	});

	test("waits while one part is pending", () => {
		expect(shouldContinueTurn(reply(upload("input-available")))).toBe(false);
		expect(
			shouldContinueTurn(
				reply(upload("input-available"), deleteBot("approval-responded")),
			),
		).toBe(false);
		expect(
			shouldContinueTurn(
				reply(upload("output-available"), deleteBot("approval-requested")),
			),
		).toBe(false);
	});

	test("never continues a finished server-tool step", () => {
		expect(shouldContinueTurn(reply(findBots))).toBe(false);
	});
});
