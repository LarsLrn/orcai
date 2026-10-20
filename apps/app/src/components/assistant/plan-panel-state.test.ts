import { describe, expect, test } from "bun:test";
import {
	nextPlanOpen,
	type PlanView,
	planApprovalAnswers,
	SUPERSEDED_PLAN_REASON,
} from "./plan-panel-state";

const view = (overrides: Partial<PlanView> = {}): PlanView => ({
	title: "Set up the citation bot",
	finished: false,
	awaitingApproval: false,
	...overrides,
});

describe("nextPlanOpen", () => {
	test("the first plan opens", () => {
		expect(
			nextPlanOpen({
				previous: undefined,
				next: view(),
				open: false,
			}),
		).toBe(true);
	});

	test("finishing the plan collapses it once", () => {
		expect(
			nextPlanOpen({
				previous: view(),
				next: view({
					finished: true,
				}),
				open: true,
			}),
		).toBe(false);
		expect(
			nextPlanOpen({
				previous: view({
					finished: true,
				}),
				next: view({
					finished: true,
				}),
				open: true,
			}),
		).toBe(true);
	});

	test("a new title or a proposal opens it again", () => {
		expect(
			nextPlanOpen({
				previous: view({
					finished: true,
				}),
				next: view({
					title: "Share the bot",
				}),
				open: false,
			}),
		).toBe(true);
		expect(
			nextPlanOpen({
				previous: view(),
				next: view({
					awaitingApproval: true,
				}),
				open: false,
			}),
		).toBe(true);
	});

	test("otherwise the user's toggle holds", () => {
		expect(
			nextPlanOpen({
				previous: view(),
				next: view(),
				open: false,
			}),
		).toBe(false);
	});
});

describe("planApprovalAnswers", () => {
	test("approves only the newest proposal and supersedes the older ones", () => {
		expect(
			planApprovalAnswers(
				[
					"older",
					"newest",
				],
				{
					approved: true,
				},
			),
		).toEqual([
			{
				id: "older",
				approved: false,
				reason: SUPERSEDED_PLAN_REASON,
			},
			{
				id: "newest",
				approved: true,
			},
		]);
	});

	test("gives the revision note to the newest proposal", () => {
		expect(
			planApprovalAnswers(
				[
					"only",
				],
				{
					approved: false,
					reason: "Skip the sharing step",
				},
			),
		).toEqual([
			{
				id: "only",
				approved: false,
				reason: "Skip the sharing step",
			},
		]);
	});
});
