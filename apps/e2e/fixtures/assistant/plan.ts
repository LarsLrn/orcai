import { randomUUID } from "node:crypto";
import type { ChatId } from "@orcai/core";
import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import type { InferenceMock, ScriptedToolCall } from "../inference/fixture";
import { message } from "../messages";
import {
	actStep,
	continueTurn,
	pauseTurn,
	pendingApprovalIds,
	type StoredRow,
} from "./approval";
import { pluralMessage, quoted } from "./assistant";

export type PlanItemStatus = "pending" | "in_progress" | "done" | "skipped";

export type PlanItem = {
	label: string;
	details?: string;
	status: PlanItemStatus;
};

/** A step as a label, which is pending, or with its status. */
export type PlanItemInput = string | PlanItem;

/** The tools that stay hidden until the user approved a plan. */
export const CREATE_TOOLS = [
	"createBot",
	"createTemplate",
	"createRepository",
	"createGroup",
];

/** The names without the create tools, as offered before a plan is approved. */
export const withoutCreates = (names: string[]): string[] =>
	names.filter((name) => !CREATE_TOOLS.includes(name));

export const planItems = (items: PlanItemInput[]): PlanItem[] =>
	items.map((item) =>
		typeof item === "string"
			? {
					label: item,
					status: "pending",
				}
			: item,
	);

/**
 * An `updatePlan` call setting the whole plan. Its id is unique, so it never
 * collides with the mock's counted ids, which restart on `reset()`.
 */
export const planCall = (
	title: string,
	items: PlanItemInput[],
): ScriptedToolCall => ({
	id: `call_plan_${randomUUID()}`,
	name: "updatePlan",
	input: {
		title,
		items: planItems(items),
	},
});

/** “2 of 5 done”, plus the skipped count when there is one. */
export const planTally = (items: PlanItemInput[]): string => {
	const all = planItems(items);
	const done = all.filter((item) => item.status === "done").length;
	const skipped = all.filter((item) => item.status === "skipped").length;

	return skipped > 0
		? pluralMessage("assistant_plan_tally_skipped", {
				done,
				total: all.length,
				count: skipped,
			})
		: message("assistant_plan_tally", {
				done,
				total: all.length,
			});
};

/** The work log line of an `updatePlan` call. */
export const planLine = (title: string, items: PlanItemInput[]): string =>
	message("assistant_tool_update_plan_summary", {
		title: quoted(title),
		tally: planTally(items),
	});

/**
 * Get a titled conversation past plan mode over the API: the model proposes a
 * plan, the user approves it, and the reply ends with `done`. Resets the mock
 * afterwards, so the create tools are offered from the next turn on.
 */
export const approvePlan = async (
	client: ApiClient,
	chatId: ChatId,
	inference: InferenceMock,
	plan: {
		title: string;
		items: PlanItemInput[];
		done?: string;
	},
): Promise<StoredRow> => {
	const done = plan.done ?? "The plan is approved.";

	inference.script(
		actStep("Here is my plan.", planCall(plan.title, plan.items)),
		{
			text: done,
		},
	);
	const paused = await pauseTurn(client, chatId, "Make a plan with me");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The plan did not wait for approval");

	expect(
		await continueTurn(client, {
			chatId,
			messageId: paused.id,
			approvals: [
				{
					approvalId,
					approved: true,
				},
			],
		}),
	).toBe(done);
	inference.reset();

	return paused;
};

/** The plan panel above the assistant composer. */
export const planPanel = (page: Page): Locator =>
	page.getByRole("region", {
		name: message("assistant_plan_region"),
		exact: true,
	});

/** The panel's header, which shows or hides its steps. */
export const planToggle = (panel: Locator): Locator =>
	panel.getByRole("button", {
		name: new RegExp(
			`(?:${message("assistant_plan_collapse")}|${message("assistant_plan_expand")})$`,
		),
	});

export const approvePlanButton = (panel: Locator): Locator =>
	panel.getByRole("button", {
		name: message("assistant_plan_approve"),
		exact: true,
	});

export const revisePlanButton = (panel: Locator): Locator =>
	panel.getByRole("button", {
		name: message("assistant_plan_revise"),
		exact: true,
	});

const statusLabels: Record<PlanItemStatus, string> = {
	pending: message("assistant_plan_status_pending"),
	in_progress: message("assistant_plan_status_in_progress"),
	done: message("assistant_plan_status_done"),
	skipped: message("assistant_plan_status_skipped"),
};

/** The panel shows the plan's title, tally and, open, every step with its status and details. */
export const expectPlan = async (
	panel: Locator,
	title: string,
	items: PlanItemInput[],
): Promise<void> => {
	const all = planItems(items);
	const toggle = planToggle(panel);

	await expect(toggle).toContainText(title);
	await expect(toggle).toContainText(planTally(all));
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	const steps = panel.getByRole("listitem");
	await expect(steps).toHaveCount(all.length);
	for (const [index, item] of all.entries()) {
		const step = steps.nth(index);
		await expect(step).toHaveText(`${item.label}${item.details ?? ""}`);
		await expect(
			step.getByRole("img", {
				name: statusLabels[item.status],
				exact: true,
			}),
		).toBeVisible();
	}
};
