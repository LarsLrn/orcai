import {
	actStep,
	botExists,
	cancelButton,
	cardButton,
	confirmationCard,
	continueRefusal,
	continueTurn,
	countContinuations,
	createBot,
	createdBotId,
	deleteBotCall,
	deleteBotTitle,
	lastRow,
	loadTools,
	openWorkLogEntry,
	pauseTurn,
	pendingApprovalIds,
	storedRows,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	openConversation,
	quoted,
	reasonOf,
	setUpAssistantModel,
	startTitledConversation,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import { approvePlan } from "../../fixtures/assistant/plan";
import { chatName, messageText, turnFinished } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import { systemGroup } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp } from "../../fixtures/navigation";

const LEAD_IN = "I will delete the bot now.";
const DELETE = message("common_delete_button");

test("assistant: deleteBot waits for its card and Delete continues the same reply", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Doomed");
	const chatId = await startTitledConversation(member, inference);
	const done = "The bot is gone.";
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)), {
		text: done,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const continuations = countContinuations(page);
	await ask(page, "Delete my bot");

	const card = confirmationCard(page, deleteBotTitle(bot.name));
	await expect(card).toBeVisible();
	await expect(messageText(page, LEAD_IN)).toBeVisible();
	await expect(cancelButton(card)).toBeVisible();
	const paused = await lastRow(member, chatId);
	expect(paused.role).toBe("assistant");
	expect(pendingApprovalIds(paused)).toHaveLength(1);
	expect(await botExists(member, bot.id)).toBe(true);
	expect(continuations()).toBe(0);

	await cardButton(card, DELETE).click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	expect(continuations()).toBe(1);

	const rows = await storedRows(member, chatId);
	expect(rows.map((row) => row.role)).toEqual([
		"user",
		"assistant",
		"user",
		"assistant",
	]);
	const reply = rows.at(-1) ?? paused;
	expect(reply.id).toBe(paused.id);
	expect(toolParts(reply, "deleteBot").map((part) => part.state)).toEqual([
		"output-available",
	]);
	await expect.poll(() => botExists(member, bot.id)).toBe(false);

	// Resumed, the card folds into the work log under the same summary line.
	await expect(cardButton(card, DELETE)).toHaveCount(0);
	await openWorkLogEntry(page, deleteBotTitle(bot.name));
});

test("assistant: Cancel on a card leaves the bot and logs the call as denied", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Kept");
	const chatId = await startTitledConversation(member, inference);
	const done = "I kept the bot.";
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)), {
		text: done,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Delete my bot");

	const card = confirmationCard(page, deleteBotTitle(bot.name));
	await cancelButton(card).click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);

	const reply = await lastRow(member, chatId);
	const [part] = toolParts(reply, "deleteBot");
	expect(part?.state).toBe("output-denied");
	expect(part?.approval?.approved).toBe(false);
	expect(await botExists(member, bot.id)).toBe(true);

	const entry = await openWorkLogEntry(page, deleteBotTitle(bot.name));
	await expect(
		entry.getByText(message("chat_work_log_tool_status_denied"), {
			exact: true,
		}),
	).toBeVisible();
});

test("assistant: a new message instead of an answer skips the call", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Skipped");
	const chatId = await startTitledConversation(member, inference);
	const done = "Something else, then.";
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)), {
		text: done,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const continuations = countContinuations(page);
	await ask(page, "Delete my bot");

	const card = confirmationCard(page, deleteBotTitle(bot.name));
	await expect(cardButton(card, DELETE)).toBeVisible();
	await ask(page, "Never mind, what can you do?");
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	await expect(cardButton(card, DELETE)).toHaveCount(0);
	await expect(
		card.getByText(message("chat_work_log_tool_status_skipped"), {
			exact: true,
		}),
	).toBeVisible();
	expect(continuations()).toBe(0);

	const rows = await storedRows(member, chatId);
	expect(rows).toHaveLength(6);
	const pausedRow = rows[3];
	if (!pausedRow) throw new Error("The paused reply is missing");
	const [part] = toolParts(pausedRow, "deleteBot");
	expect(part?.state).toBe("output-denied");
	expect(await botExists(member, bot.id)).toBe(true);

	// Stored, the skipped call sits in the paused reply's work log.
	await page.reload();
	await awaitHydration(page);
	const entry = await openWorkLogEntry(page, deleteBotTitle(bot.name));
	await expect(
		entry.getByText(message("chat_work_log_tool_status_skipped"), {
			exact: true,
		}),
	).toBeVisible();
});

test("assistant: a paused reply shows its lead-in and card after a reload and can still be answered", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Reloaded");
	const chatId = await startTitledConversation(member, inference);
	const done = "Deleted after the reload.";
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)), {
		text: done,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Delete my bot");
	const card = confirmationCard(page, deleteBotTitle(bot.name));
	await expect(card).toBeVisible();
	await turnFinished(page);

	await page.reload();
	await awaitHydration(page);
	// The work log is folded, so both are visible only in the answer.
	await expect(messageText(page, LEAD_IN)).toBeVisible();
	await expect(cardButton(card, DELETE)).toBeVisible();

	const continuations = countContinuations(page);
	await cardButton(card, DELETE).click();
	await expect(messageText(page, done)).toBeVisible();
	expect(continuations()).toBe(1);
	await expect.poll(() => botExists(member, bot.id)).toBe(false);
});

test("assistant: two cards in one step send one continuation once both are answered", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const first = await createBot(member, "First");
	const second = await createBot(member, "Second");
	const chatId = await startTitledConversation(member, inference);
	const done = "Both bots are gone.";
	inference.script(
		loadTools("bots"),
		actStep(
			"I will delete both bots.",
			deleteBotCall(first.id),
			deleteBotCall(second.id),
		),
		{
			text: done,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const continuations = countContinuations(page);
	await ask(page, "Delete both bots");

	const firstCard = confirmationCard(page, deleteBotTitle(first.name));
	const secondCard = confirmationCard(page, deleteBotTitle(second.name));
	await expect(cardButton(secondCard, DELETE)).toBeVisible();

	await cardButton(firstCard, DELETE).click();
	await expect(
		firstCard.getByText(message("chat_work_log_tool_status_approved"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(cardButton(secondCard, DELETE)).toBeVisible();
	expect(continuations()).toBe(0);
	expect(turnRequests(inference)).toHaveLength(2);

	await cardButton(secondCard, DELETE).click();
	await expect(messageText(page, done)).toBeVisible();
	expect(continuations()).toBe(1);
	expect(turnRequests(inference)).toHaveLength(3);
	await expect.poll(() => botExists(member, first.id)).toBe(false);
	await expect.poll(() => botExists(member, second.id)).toBe(false);
});

test("assistant: a second page answering the same card is refused and nothing runs twice", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Twice");
	const chatId = await startTitledConversation(member, inference);
	const done = "Deleted once.";
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)), {
		text: done,
	});

	const first = await pageAs("member");
	const second = await pageAs("member");
	await enterApp(first, org.slug);
	await enterApp(second, org.slug);
	await openConversation(first, chatId);
	await ask(first, "Delete my bot");
	const firstCard = confirmationCard(first, deleteBotTitle(bot.name));
	await expect(cardButton(firstCard, DELETE)).toBeVisible();

	await openConversation(second, chatId);
	const secondCard = confirmationCard(second, deleteBotTitle(bot.name));
	await expect(cardButton(secondCard, DELETE)).toBeVisible();

	await cardButton(firstCard, DELETE).click();
	await expect(messageText(first, done)).toBeVisible();
	await turnFinished(first);

	await cardButton(secondCard, DELETE).click();
	await expect(
		second.getByRole("alert").filter({
			hasText: message("error_chat_turn_not_awaiting"),
		}),
	).toBeVisible();
	// The refused page reloads what the other one left.
	await expect(messageText(second, done)).toBeVisible();

	expect(turnRequests(inference)).toHaveLength(3);
	const rows = await storedRows(member, chatId);
	expect(rows).toHaveLength(4);
	const reply = rows.at(-1);
	if (!reply) throw new Error("The reply is missing");
	expect(toolParts(reply, "deleteBot").map((part) => part.state)).toEqual([
		"output-available",
	]);
});

test("assistant: a call approved after a pause sees the bot saved earlier in the turn", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const spare = await createBot(member, "Spare");
	const group = await systemGroup(member);
	const name = chatName("Shared");
	const chatId = await startTitledConversation(member, inference);
	await approvePlan(member, chatId, inference, {
		title: "Set up and share a bot",
		items: [
			"Create the bot",
			"Share it with everyone",
		],
	});
	inference.script(
		loadTools("bots"),
		// The pause on the spare bot lets the spec learn the new bot's id.
		actStep(
			"I will set up the bot and tidy up.",
			{
				name: "createBot",
				input: {
					name,
					description: "Set up by the assistant.",
				},
			},
			deleteBotCall(spare.id),
		),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Set up a bot and share it with everyone");
	const spareCard = confirmationCard(page, deleteBotTitle(spare.name));
	await expect(cancelButton(spareCard)).toBeVisible();

	const botId = createdBotId(await lastRow(member, chatId));

	const done = "Everyone can use it now.";
	inference.script(
		loadTools("sharing"),
		actStep("I will share it.", {
			name: "grantAccess",
			input: {
				resourceType: "bot",
				resourceId: botId,
				principals: [
					{
						principalType: "group",
						principalId: group.id,
					},
				],
				role: "viewer",
			},
		}),
		{
			text: done,
		},
	);
	await cancelButton(spareCard).click();

	const grantCard = confirmationCard(
		page,
		message("assistant_tool_grant_access_summary", {
			names: quoted(group.name),
			role: message("access_role_viewer_label"),
			resource: quoted(name),
		}),
	);
	await expect(grantCard).toBeVisible();
	await cardButton(grantCard, message("assistant_confirmation_grant")).click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);

	const reply = await lastRow(member, chatId);
	const [granted] = toolParts(reply, "grantAccess");
	expect(granted?.errorText).toBeUndefined();
	expect(granted?.state).toBe("output-available");
	expect(await botExists(member, spare.id)).toBe(true);

	await expect(async () => {
		const grants = await member.resource.listGrants({
			resourceType: "bot",
			resourceId: botId,
		});
		expect(
			grants.data.find(
				(grant) =>
					String(grant.principalId) === group.id && grant.revokedAt === null,
			)?.role,
		).toBe("viewer");
	}).toPass();
});

test("assistant: a continuation must answer every card of the step, once", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const first = await createBot(member, "Incomplete First");
	const second = await createBot(member, "Incomplete Second");
	const chatId = await startTitledConversation(member, inference);
	inference.script(
		loadTools("bots"),
		actStep(
			"I will delete both bots.",
			deleteBotCall(first.id),
			deleteBotCall(second.id),
		),
	);

	const paused = await pauseTurn(member, chatId, "Delete both bots");
	const approvalIds = pendingApprovalIds(paused);
	const [firstApproval] = approvalIds;
	expect(approvalIds).toHaveLength(2);
	if (!firstApproval) throw new Error("The reply did not pause");
	const turn = {
		chatId,
		messageId: paused.id,
	};

	for (const approvals of [
		[
			{
				approvalId: firstApproval,
				approved: true,
			},
		],
		[],
		[
			...approvalIds.map((approvalId) => ({
				approvalId,
				approved: true,
			})),
			{
				approvalId: "unknown-approval",
				approved: true,
			},
		],
	]) {
		expect(
			reasonOf(
				await continueRefusal(member, {
					...turn,
					approvals,
				}),
			),
		).toBe("CHAT_TURN_DECISIONS_INCOMPLETE");
	}
	expect(await lastRow(member, chatId)).toEqual(paused);
	expect(turnRequests(inference)).toHaveLength(2);
	expect(await botExists(member, first.id)).toBe(true);
	expect(await botExists(member, second.id)).toBe(true);

	const done = "Both bots are gone.";
	inference.script({
		text: done,
	});
	const answers = approvalIds.map((approvalId) => ({
		approvalId,
		approved: true,
	}));
	expect(
		await continueTurn(member, {
			...turn,
			approvals: answers,
		}),
	).toBe(done);

	expect(
		reasonOf(
			await continueRefusal(member, {
				...turn,
				approvals: answers,
			}),
		),
	).toBe("CHAT_TURN_NOT_AWAITING");
	expect(turnRequests(inference)).toHaveLength(3);
	await expect.poll(() => botExists(member, first.id)).toBe(false);
	await expect.poll(() => botExists(member, second.id)).toBe(false);
});

test("assistant: a continuation refused for quota stores nothing", async ({
	api,
	inference,
	org,
}) => {
	const model = await setUpAssistantModel(api, org, inference);
	const admin = api.as("admin");
	const member = api.as("member");
	const bot = await createBot(member, "Unpaid");
	const chatId = await startTitledConversation(member, inference);
	inference.script(loadTools("bots"), actStep(LEAD_IN, deleteBotCall(bot.id)));

	const paused = await pauseTurn(member, chatId, "Delete my bot");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The reply did not pause");

	const allMembers = await systemGroup(admin);
	await admin.quota.create({
		name: chatName("Exhausted Pool"),
		providerId: model.providerId,
		modelId: model.modelId,
		periodType: "monthly",
		budgetAmount: 1,
		groupIds: [
			allMembers.id,
		],
	});

	expect(
		reasonOf(
			await continueRefusal(member, {
				chatId,
				messageId: paused.id,
				approvals: [
					{
						approvalId,
						approved: true,
					},
				],
			}),
		),
	).toBe("QUOTA_EXHAUSTED");
	expect(await lastRow(member, chatId)).toEqual(paused);
	expect(turnRequests(inference)).toHaveLength(2);
	expect(await botExists(member, bot.id)).toBe(true);
});
