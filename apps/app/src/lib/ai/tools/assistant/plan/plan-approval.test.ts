import { describe, expect, test } from "bun:test";
import { isPlanApproved } from "./plan-approval";

const planPart = (state: string, approval?: Record<string, unknown>) => ({
	type: "tool-updatePlan",
	toolCallId: `plan-${state}`,
	state,
	input: {
		title: "Set up the course",
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
	...(approval
		? {
				approval,
			}
		: {}),
});

const assistant = (...parts: unknown[]) => ({
	role: "assistant",
	parts,
});

describe("isPlanApproved", () => {
	test("an approved plan that ran is approved", () => {
		expect(
			isPlanApproved([
				{
					role: "user",
					parts: [
						{
							type: "text",
							text: "Set up my course",
						},
					],
				},
				assistant(
					{
						type: "text",
						text: "Here is the plan.",
					},
					planPart("output-available", {
						id: "approval-1",
						approved: true,
					}),
				),
			]),
		).toBe(true);
	});

	test("an earlier approved plan counts after later ungated updates", () => {
		expect(
			isPlanApproved([
				assistant(
					planPart("output-available", {
						id: "approval-1",
						approved: true,
					}),
				),
				assistant(planPart("output-available")),
			]),
		).toBe(true);
	});

	test.each([
		[
			"a requested approval",
			planPart("approval-requested", {
				id: "approval-1",
			}),
		],
		[
			"an approval that has not run",
			planPart("approval-responded", {
				id: "approval-1",
				approved: true,
			}),
		],
		[
			"a denied plan",
			planPart("output-denied", {
				id: "approval-1",
				approved: false,
			}),
		],
		[
			"a plan that ran without approval",
			planPart("output-available"),
		],
		[
			"another approved tool",
			{
				...planPart("output-available", {
					id: "approval-1",
					approved: true,
				}),
				type: "tool-deleteBot",
			},
		],
	])("%s is not an approved plan", (_, part) => {
		expect(
			isPlanApproved([
				assistant(part),
			]),
		).toBe(false);
	});

	test("an approved plan part in a user message does not count", () => {
		expect(
			isPlanApproved([
				{
					role: "user",
					parts: [
						planPart("output-available", {
							id: "approval-1",
							approved: true,
						}),
					],
				},
			]),
		).toBe(false);
	});

	test("an empty conversation has no approved plan", () => {
		expect(isPlanApproved([])).toBe(false);
	});
});
