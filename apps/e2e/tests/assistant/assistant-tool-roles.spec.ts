import {
	actStep,
	continueTurn,
	createBot,
	deleteBotCall,
	lastRow,
	loadTools,
	pauseTurn,
	pendingApprovalIds,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	BOTS_TOOLS,
	offeredTools,
	PEOPLE_TOOLS,
	SHARING_TOOLS,
	setUpAssistantModel,
	sortedNames,
	startConversation,
	startTitledConversation,
	toolMessages,
	turnRequests,
	VIEWER_TOOLS,
} from "../../fixtures/assistant/assistant";
import { ask } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";

const EXPECTED = {
	viewer: sortedNames(VIEWER_TOOLS),
	member: sortedNames([
		...VIEWER_TOOLS,
		"loadTools",
	]),
	manager: sortedNames([
		...VIEWER_TOOLS,
		"listMembers",
		"loadTools",
	]),
	admin: sortedNames([
		...VIEWER_TOOLS,
		"listMembers",
		"loadTools",
	]),
};

test("assistant: each role is offered its core tools and no deferred tool before loading", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);

	for (const role of [
		"viewer",
		"member",
		"manager",
		"admin",
	] as const) {
		inference.reset();
		const client = api.as(role);
		const chatId = await startConversation(client);
		inference.respondWith({
			text: `Hello, ${role}.`,
		});

		expect(await ask(client, chatId, "What can you do?")).toBe(
			`Hello, ${role}.`,
		);

		const [request] = turnRequests(inference);
		expect(offeredTools(request), role).toEqual(EXPECTED[role]);
	}
});

test("assistant: a member loading bots gets the bots group, loading people gets nothing", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);

	inference.script(loadTools("bots"), {
		text: "The bot tools are loaded.",
	});
	expect(await ask(member, chatId, "Help me with my bots")).toBe(
		"The bot tools are loaded.",
	);

	const bots = turnRequests(inference);
	expect(bots).toHaveLength(2);
	expect(offeredTools(bots[0])).toEqual(EXPECTED.member);
	expect(offeredTools(bots[1])).toEqual(
		sortedNames([
			...EXPECTED.member,
			...BOTS_TOOLS,
		]),
	);

	inference.reset();
	inference.script(loadTools("people"), {
		text: "There are no people tools for you.",
	});
	expect(await ask(member, chatId, "Invite a colleague")).toBe(
		"There are no people tools for you.",
	);

	const people = turnRequests(inference);
	expect(people).toHaveLength(2);
	const withBots = sortedNames([
		...EXPECTED.member,
		...BOTS_TOOLS,
	]);
	expect(offeredTools(people[0])).toEqual(withBots);
	expect(offeredTools(people[1])).toEqual(withBots);
	for (const name of PEOPLE_TOOLS) {
		expect(offeredTools(people[1])).not.toContain(name);
	}
	expect(toolMessages(people[1]).at(-1)).toEqual({
		groups: [
			{
				group: "people",
				loaded: false,
				error: expect.stringMatching(/^FORBIDDEN: /),
			},
		],
	});
});

test("assistant: a loaded group stays offered in the next turn and after an approval resume", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const bot = await createBot(member, "Resumed");
	const chatId = await startTitledConversation(member, inference);
	const withBots = sortedNames([
		...EXPECTED.member,
		...BOTS_TOOLS,
	]);
	const withBotsAndSharing = sortedNames([
		...withBots,
		...SHARING_TOOLS,
	]);

	inference.script(loadTools("bots"), {
		text: "The bot tools are loaded.",
	});
	await ask(member, chatId, "Help me with my bots");

	inference.reset();
	inference.script(
		loadTools("sharing"),
		actStep("I will delete the bot now.", deleteBotCall(bot.id)),
	);
	const paused = await pauseTurn(member, chatId, "Delete my bot");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The reply did not pause");

	const turn = turnRequests(inference);
	expect(turn).toHaveLength(2);
	expect(offeredTools(turn[0])).toEqual(withBots);
	expect(offeredTools(turn[1])).toEqual(withBotsAndSharing);

	inference.reset();
	const done = "The bot is gone.";
	inference.script(
		{
			toolCalls: [
				{
					name: "findBots",
					input: {
						query: bot.name,
					},
				},
			],
		},
		{
			text: done,
		},
	);
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

	const resumed = turnRequests(inference);
	expect(resumed).toHaveLength(2);
	for (const request of resumed) {
		expect(offeredTools(request)).toEqual(withBotsAndSharing);
	}
	expect(toolParts(await lastRow(member, chatId), "deleteBot")).toMatchObject([
		{
			state: "output-available",
		},
	]);
});
