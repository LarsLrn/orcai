import type { ChatId } from "@orcai/core";
import type { Locator } from "@playwright/test";
import type { ZedTokenStore } from "../../fixtures/api";
import {
	actStep,
	botExists,
	cardButton,
	confirmationCard,
	continueTurn,
	createBot,
	createdBotId,
	deleteBotCall,
	deleteBotTitle,
	lastRow,
	loadTools,
	openWorkLogEntry,
	pauseTurn,
	pendingApprovalIds,
	type StoredRow,
	storedRows,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	BOTS_TOOLS,
	isRecord,
	offeredTools,
	openConversation,
	setUpAssistantModel,
	startTitledConversation,
	toolResultsOf,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import {
	approvePlan,
	approvePlanButton,
	CREATE_TOOLS,
	expectPlan,
	type PlanItemInput,
	planCall,
	planItems,
	planLine,
	planPanel,
	planTally,
	planToggle,
	revisePlanButton,
	withoutCreates,
} from "../../fixtures/assistant/plan";
import {
	ask as askOverApi,
	chatName,
	composer,
	createChat,
	messageText,
	turnFinished,
} from "../../fixtures/chat/chat";
import {
	ask,
	createBotChat,
	createBot as createGenUiBot,
} from "../../fixtures/gen-ui/gen-ui";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type ScriptedToolCall,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp } from "../../fixtures/navigation";

const PROPOSAL = "Here is my plan for the course bot.";
const STEPS = [
	"Create the course bot",
	"Write its instructions",
	"Share it with the class",
];
const AWAITING = message("assistant_plan_awaiting_approval");

const createBotCall = (name: string): ScriptedToolCall => ({
	name: "createBot",
	input: {
		name,
		description: "Set up by the assistant plan specs.",
	},
});

const loadToolsCall = (group: "bots"): ScriptedToolCall => {
	const [call] = loadTools(group).toolCalls ?? [];
	if (!call) throw new Error("loadTools has no call");

	return call;
};

/** The content of the tool message that answers a call. */
const toolResultFor = (body: unknown, callId: string | undefined): unknown =>
	(isRecord(body) && Array.isArray(body.messages) ? body.messages : []).find(
		(entry: unknown) =>
			isRecord(entry) && entry.role === "tool" && entry.tool_call_id === callId,
	)?.content;

/** The parsed result a request sends the model for a call. */
const parsedResultFor = (body: unknown, callId: string | undefined): unknown =>
	JSON.parse(String(toolResultFor(body, callId)));

/** The parsed arguments of a request's newest call of a tool. */
const lastCallInput = (body: unknown, name: string): unknown => {
	const calls = (
		isRecord(body) && Array.isArray(body.messages) ? body.messages : []
	).flatMap((entry: unknown) =>
		isRecord(entry) && Array.isArray(entry.tool_calls) ? entry.tool_calls : [],
	);
	const call = calls
		.filter(
			(candidate: unknown) =>
				isRecord(candidate) &&
				isRecord(candidate.function) &&
				candidate.function.name === name,
		)
		.at(-1);

	return isRecord(call) &&
		isRecord(call.function) &&
		typeof call.function.arguments === "string"
		? JSON.parse(call.function.arguments)
		: undefined;
};

/**
 * Whether the bot the last reply created reads back. No cookie carries a
 * streamed turn's writes; the reply's settled zedToken does.
 */
const createdBotExists = async (
	client: ApiClient,
	chatId: ChatId,
	zedTokens: ZedTokenStore,
): Promise<boolean> => {
	let reply: StoredRow | undefined;
	await expect
		.poll(async () => {
			reply = await lastRow(client, chatId);
			return reply.zedToken;
		})
		.toBeDefined();
	if (!reply?.zedToken) throw new Error("The reply settled no zedToken");
	zedTokens.write(reply.zedToken);

	return await botExists(client, createdBotId(reply));
};

const expectExpanded = async (
	panel: Locator,
	expanded: boolean,
): Promise<void> => {
	await expect(planToggle(panel)).toHaveAttribute(
		"aria-expanded",
		String(expanded),
	);
	await expect(panel.getByRole("list")).toBeVisible({
		visible: expanded,
	});
};

test("assistant: the create tools are offered once a plan is approved, from the approving continuation on", async ({
	api,
	inference,
	org,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const botName = chatName("Planned Bot");
	const done = "The bot is set up.";
	const proposal = planCall("Set up the course bot", STEPS);

	inference.script(
		loadTools("bots"),
		actStep(PROPOSAL, proposal),
		{
			toolCalls: [
				createBotCall(botName),
			],
		},
		{
			text: done,
		},
	);
	const paused = await pauseTurn(member, chatId, "Set up a course bot");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The plan did not wait for approval");
	expect(toolParts(paused, "updatePlan")).toMatchObject([
		{
			state: "approval-requested",
		},
	]);

	const proposing = turnRequests(inference);
	expect(proposing).toHaveLength(2);
	for (const request of proposing) {
		expect(offeredTools(request)).toContain("updatePlan");
	}
	expect(offeredTools(proposing[1])).toEqual(
		expect.arrayContaining(withoutCreates(BOTS_TOOLS)),
	);
	for (const name of CREATE_TOOLS) {
		expect(offeredTools(proposing[1])).not.toContain(name);
	}

	expect(
		await continueTurn(member, {
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

	const resumed = turnRequests(inference).slice(2);
	expect(resumed).toHaveLength(2);
	for (const request of resumed) {
		expect(offeredTools(request)).toEqual(expect.arrayContaining(BOTS_TOOLS));
	}
	// The provider drops the approval itself, so the result tells the model.
	expect(parsedResultFor(resumed[0], proposal.id)).toEqual({
		updated: true,
		approved: true,
		unlockedTools: CREATE_TOOLS.filter((name) => BOTS_TOOLS.includes(name)),
	});
	const reply = await lastRow(member, chatId);
	expect(toolParts(reply, "updatePlan")).toMatchObject([
		{
			state: "output-available",
			approval: {
				approved: true,
			},
		},
	]);
	expect(await createdBotExists(member, chatId, zedTokens)).toBe(true);

	inference.reset();
	inference.script({
		text: "You are welcome.",
	});
	await askOverApi(member, chatId, "Thanks");
	const [later] = turnRequests(inference);
	expect(offeredTools(later)).toEqual(expect.arrayContaining(BOTS_TOOLS));
});

test("assistant: bot chats and plain chats are not offered updatePlan", async ({
	api,
	inference,
	org,
}) => {
	const model = await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createGenUiBot(member);

	for (const chatId of [
		await createBotChat(member, model, bot.id),
		await createChat(member, model, chatName("Plain")),
	]) {
		inference.reset();
		await askOverApi(member, chatId, "Which tools do you have?");
		const [request] = turnRequests(inference);
		expect(offeredTools(request)).not.toContain("updatePlan");
		expect(offeredTools(request)).not.toContain("loadTools");
	}
});

test("assistant: a proposed plan waits above the composer and Approve plan runs it step by step", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const title = "Set up the course bot";
	const done = "The course bot is ready.";
	const started: PlanItemInput[] = [
		{
			label: STEPS[0] as string,
			status: "in_progress",
		},
		STEPS[1] as string,
		STEPS[2] as string,
	];
	const halfway: PlanItemInput[] = [
		{
			label: STEPS[0] as string,
			status: "done",
		},
		{
			label: STEPS[1] as string,
			status: "in_progress",
		},
		STEPS[2] as string,
	];
	const finished: PlanItemInput[] = [
		{
			label: STEPS[0] as string,
			status: "done",
		},
		{
			label: STEPS[1] as string,
			status: "done",
		},
		{
			label: STEPS[2] as string,
			status: "skipped",
		},
	];

	const proposal = planCall(title, STEPS);
	const startedCall = planCall(title, started);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	inference.script(actStep(PROPOSAL, proposal));
	await ask(page, "Set up a course bot");

	const panel = planPanel(page);
	await expectPlan(panel, title, STEPS);
	await expect(
		panel.getByText(AWAITING, {
			exact: true,
		}),
	).toBeVisible();
	await expect(revisePlanButton(panel)).toBeVisible();
	await expect(approvePlanButton(panel)).toBeVisible();
	await turnFinished(page);

	const panelBox = await panel.boundingBox();
	const composerBox = await composer(page).boundingBox();
	if (!panelBox || !composerBox) throw new Error("Panel or composer hidden");
	expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(composerBox.y);

	// The answer is the step's text: no plan steps and no Confirmation card.
	const log = page.getByRole("log");
	await expect(messageText(page, PROPOSAL)).toBeVisible();
	for (const step of STEPS) {
		await expect(log.getByText(step)).toHaveCount(0);
	}
	await expect(confirmationCard(page, planLine(title, STEPS))).toHaveCount(0);
	await expect(
		log.getByRole("button", {
			name: message("assistant_plan_approve"),
		}),
	).toHaveCount(0);
	await openWorkLogEntry(page, planLine(title, STEPS));

	inference.script(
		{
			toolCalls: [
				startedCall,
				loadToolsCall("bots"),
			],
		},
		// Held, so the panel shows the plan before the next step.
		{
			toolCalls: [
				createBotCall(chatName("Course Bot")),
			],
			hold: "response",
		},
		{
			toolCalls: [
				planCall(title, halfway),
			],
		},
		{
			toolCalls: [
				planCall(title, finished),
			],
			hold: "response",
		},
		{
			text: done,
		},
	);
	await approvePlanButton(panel).click();

	await expect(planToggle(panel)).toContainText(planTally(started));
	await expectPlan(panel, title, started);
	await expect(approvePlanButton(panel)).toHaveCount(0);
	await expect(panel.getByText(AWAITING)).toHaveCount(0);
	await expect.poll(() => inference.held()).toBe(1);
	inference.release();

	await expect(planToggle(panel)).toContainText(planTally(halfway));
	await expectPlan(panel, title, halfway);
	await expect.poll(() => inference.held()).toBe(1);
	inference.release();

	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	// Finishing the plan collapses it once.
	await expect(planToggle(panel)).toContainText(planTally(finished));
	await expectExpanded(panel, false);

	const reply = await lastRow(member, chatId);
	expect(toolParts(reply, "updatePlan").map((part) => part.state)).toEqual([
		"output-available",
		"output-available",
		"output-available",
		"output-available",
	]);
	expect(toolParts(reply, "createBot")).toMatchObject([
		{
			state: "output-available",
		},
	]);

	// Approved before any group loaded, the plan unlocks no tool yet; later plans need no approval.
	const [, approving, afterStart] = turnRequests(inference);
	expect(parsedResultFor(approving, proposal.id)).toEqual({
		updated: true,
		approved: true,
	});
	expect(parsedResultFor(afterStart, startedCall.id)).toEqual({
		updated: true,
	});
});

test("assistant: after approval a new plan runs without approval, reopens the panel, and survives a reload", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const title = "Tidy the bots";
	const started: PlanItemInput[] = [
		{
			label: "Find the old bots",
			status: "in_progress",
		},
		"Archive them",
	];
	await approvePlan(member, chatId, inference, {
		title,
		items: [
			"Find the old bots",
			"Archive them",
		],
	});
	inference.script(
		{
			toolCalls: [
				planCall(title, started),
			],
		},
		{
			text: "I started on the bots.",
		},
	);
	await askOverApi(member, chatId, "Go on");

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const panel = planPanel(page);
	await expectPlan(panel, title, started);
	await expect(approvePlanButton(panel)).toHaveCount(0);

	// The header toggles by keyboard; collapsed, it names the step in progress.
	const toggle = planToggle(panel);
	await toggle.focus();
	await page.keyboard.press("Enter");
	await expectExpanded(panel, false);
	await expect(toggle).toContainText("Find the old bots");
	await expect(toggle).toContainText(message("assistant_plan_expand"));
	await page.keyboard.press("Space");
	await expectExpanded(panel, true);
	await page.keyboard.press("Enter");
	await expectExpanded(panel, false);

	const next = "Share the new bot";
	const nextItems: PlanItemInput[] = [
		{
			label: "Create the bot",
			status: "done",
		},
		{
			label: "Share it",
			status: "in_progress",
		},
	];
	const replanned = "I made a new plan.";
	inference.script(
		{
			toolCalls: [
				planCall(next, nextItems),
			],
		},
		{
			text: replanned,
		},
	);
	await ask(page, "Let us share a bot instead");
	await expect(messageText(page, replanned)).toBeVisible();
	await turnFinished(page);
	// A new title opens the panel again; approved, the plan does not pause.
	await expectPlan(panel, next, nextItems);
	await expect(approvePlanButton(panel)).toHaveCount(0);
	const reply = await lastRow(member, chatId);
	expect(pendingApprovalIds(reply)).toEqual([]);
	const [part] = toolParts(reply, "updatePlan");
	expect(part?.state).toBe("output-available");
	expect(part?.approval).toBeUndefined();

	await page.reload();
	await awaitHydration(page);
	await expectPlan(panel, next, nextItems);
});

test("assistant: Revise declines the plan with a note the model reads, and a new proposal waits again", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const title = "Set up the course bot";
	const proposal = planCall(title, STEPS);
	const note = "Skip the sharing, I will do that myself.";
	const revised = "Set up the course bot only";
	const revisedSteps = STEPS.slice(0, 2);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	inference.script(actStep(PROPOSAL, proposal));
	await ask(page, "Set up a course bot");

	const panel = planPanel(page);
	await revisePlanButton(panel).click();
	const field = panel.getByRole("textbox", {
		name: message("assistant_plan_revise_note_label"),
	});
	const submit = panel.getByRole("button", {
		name: message("assistant_plan_revise_submit"),
		exact: true,
	});
	await expect(field).toBeFocused();
	await expect(submit).toBeDisabled();
	await panel
		.getByRole("button", {
			name: message("common_cancel_button"),
			exact: true,
		})
		.click();
	await expect(field).toHaveCount(0);
	await revisePlanButton(panel).click();

	inference.script(
		actStep("Here is the revised plan.", planCall(revised, revisedSteps)),
	);
	await field.fill(note);
	await expect(submit).toBeEnabled();
	await submit.click();

	await expectPlan(panel, revised, revisedSteps);
	await expect(approvePlanButton(panel)).toBeVisible();
	await turnFinished(page);

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(2);
	expect(String(toolResultFor(requests[1], proposal.id))).toContain(note);

	const rows = await storedRows(member, chatId);
	const reply = rows.at(-1);
	if (!reply) throw new Error("The reply is missing");
	expect(toolParts(reply, "updatePlan")).toMatchObject([
		{
			state: "output-denied",
			approval: {
				approved: false,
				reason: note,
			},
		},
		{
			state: "approval-requested",
		},
	]);
});

test("assistant: a new message instead of an answer supersedes the plan and keeps the conversation in plan mode", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const other = "Sure, what else?";

	inference.script(
		loadTools("bots"),
		actStep(PROPOSAL, planCall("Set up the course bot", STEPS)),
		{
			text: other,
		},
	);
	const paused = await pauseTurn(member, chatId, "Set up a course bot");
	expect(pendingApprovalIds(paused)).toHaveLength(1);

	expect(await askOverApi(member, chatId, "Never mind that")).toBe(other);
	const superseded = (await storedRows(member, chatId)).find(
		(row) => row.id === paused.id,
	);
	if (!superseded) throw new Error("The paused reply is missing");
	expect(toolParts(superseded, "updatePlan")).toMatchObject([
		{
			state: "output-denied",
		},
	]);
	const requests = turnRequests(inference);
	expect(requests).toHaveLength(3);
	expect(offeredTools(requests[2])).toEqual(
		expect.arrayContaining(withoutCreates(BOTS_TOOLS)),
	);
	for (const name of CREATE_TOOLS) {
		expect(offeredTools(requests[2])).not.toContain(name);
	}

	// A superseded proposal is no plan.
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await expect(messageText(page, other)).toBeVisible();
	await expect(planPanel(page)).toHaveCount(0);

	const again = "Set up the course bot after all";
	inference.script(actStep(PROPOSAL, planCall(again, STEPS)));
	await ask(page, "Let us do the bot after all");
	const panel = planPanel(page);
	await expectPlan(panel, again, STEPS);
	await expect(approvePlanButton(panel)).toBeVisible();
	expect(
		toolParts(await lastRow(member, chatId), "updatePlan").map(
			(part) => part.state,
		),
	).toEqual([
		"approval-requested",
	]);

	// Superseding in the page hides the proposal at once, without a reload.
	const instead = "Then we leave it for now.";
	inference.script({
		text: instead,
	});
	await ask(page, "Not now");
	await expect(messageText(page, instead)).toBeVisible();
	await expect(planPanel(page)).toHaveCount(0);
});

test("assistant: after approval later turns create without a new approval, and the newest plan is whole in later requests", async ({
	api,
	inference,
	org,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	await approvePlan(member, chatId, inference, {
		title: "Set up the course bot",
		items: STEPS,
	});

	const title = "Set up a second bot";
	const items = planItems([
		{
			label: "Create the second bot",
			status: "done",
		},
		{
			label: "Tell the class",
			status: "skipped",
		},
	]);
	const done = "The second bot is set up.";
	inference.script(
		loadTools("bots"),
		{
			toolCalls: [
				planCall(title, [
					{
						label: "Create the second bot",
						status: "in_progress",
					},
					"Tell the class",
				]),
			],
		},
		{
			toolCalls: [
				createBotCall(chatName("Second Bot")),
			],
		},
		{
			toolCalls: [
				planCall(title, items),
			],
		},
		{
			text: done,
		},
	);
	expect(await askOverApi(member, chatId, "Set up a second bot")).toBe(done);

	const reply = await lastRow(member, chatId);
	expect(pendingApprovalIds(reply)).toEqual([]);
	expect(
		toolParts(reply, "updatePlan").map((part) => [
			part.state,
			part.approval,
		]),
	).toEqual([
		[
			"output-available",
			undefined,
		],
		[
			"output-available",
			undefined,
		],
	]);
	expect(await createdBotExists(member, chatId, zedTokens)).toBe(true);

	inference.reset();
	inference.script({
		text: "You are welcome.",
	});
	await askOverApi(member, chatId, "Thanks");
	const [later] = turnRequests(inference);
	expect(lastCallInput(later, "updatePlan")).toEqual({
		title,
		items,
	});
	const finalPlan = toolParts(reply, "updatePlan").at(-1);
	expect(finalPlan?.input).toEqual({
		title,
		items,
	});
	// Outside the latest step, the plan's output is its summary line.
	expect(toolResultsOf(later)).toContain(planLine(title, items));
});

test("assistant: deleteBot needs no plan and still shows its card after a plan was approved", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const lead = "I will delete the bot now.";

	// Before any plan, a delete waits for its card alone.
	const unplanned = await createBot(member, "Unplanned");
	const first = await startTitledConversation(member, inference);
	inference.script(
		loadTools("bots"),
		actStep(lead, deleteBotCall(unplanned.id)),
		{
			text: "Deleted.",
		},
	);
	const paused = await pauseTurn(member, first, "Delete my bot");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The delete did not wait for approval");
	expect(toolParts(paused, "deleteBot")).toMatchObject([
		{
			state: "approval-requested",
		},
	]);
	await continueTurn(member, {
		chatId: first,
		messageId: paused.id,
		approvals: [
			{
				approvalId,
				approved: true,
			},
		],
	});
	await expect.poll(() => botExists(member, unplanned.id)).toBe(false);

	inference.reset();
	const planned = await createBot(member, "Planned");
	const second = await startTitledConversation(member, inference);
	await approvePlan(member, second, inference, {
		title: "Clean up the bots",
		items: [
			"Delete the old bot",
		],
	});
	const done = "The old bot is gone.";
	inference.script(
		loadTools("bots"),
		actStep(lead, deleteBotCall(planned.id)),
		{
			text: done,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, second);
	await ask(page, "Delete my old bot");
	const card = confirmationCard(page, deleteBotTitle(planned.name));
	await expect(card).toBeVisible();
	expect(await botExists(member, planned.id)).toBe(true);
	await cardButton(card, message("common_delete_button")).click();
	await expect(messageText(page, done)).toBeVisible();
	await expect.poll(() => botExists(member, planned.id)).toBe(false);
});

test("assistant: a plan with a step label over the limit fails as a tool error, and the model retries in the same turn", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const title = "Set up the course bot";
	const tooLong = "Lege einen Kursbot an, ".repeat(12);
	const items: PlanItemInput[] = [
		{
			label: "Create the course bot",
			details: tooLong,
			status: "pending",
		},
		STEPS[1] as string,
	];

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	inference.script(
		actStep(
			PROPOSAL,
			planCall(title, [
				{
					label: tooLong,
					status: "pending",
				},
				STEPS[1] as string,
			]),
		),
		actStep(PROPOSAL, planCall(title, items)),
	);
	await ask(page, "Set up a course bot");
	await turnFinished(page);

	const panel = planPanel(page);
	await expectPlan(panel, title, items);
	await expect(approvePlanButton(panel)).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);

	const [, retry] = turnRequests(inference);
	expect(JSON.stringify(toolResultsOf(retry))).toContain(
		"Invalid input for tool updatePlan",
	);
	expect(
		toolParts(await lastRow(member, chatId), "updatePlan").map(
			(part) => part.state,
		),
	).toEqual([
		"output-error",
		"approval-requested",
	]);
});
