import type { BlockId, BotId } from "@orcai/core";
import { lastRow, loadTools } from "../../fixtures/assistant/approval";
import {
	BOTS_TOOLS,
	expandWorkLog,
	heldTurnRequest,
	historyToolCallsOf,
	isRecord,
	offeredTools,
	openConversation,
	quoted,
	setUpAssistantModel,
	startTitledConversation,
	toolMessages,
	toolResultsOf,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import { approvePlan } from "../../fixtures/assistant/plan";
import { assetRow } from "../../fixtures/authz/resources";
import { chatName, messageText } from "../../fixtures/chat/chat";
import { ask, turnFinished } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

/** The output of a tool result naming the given value, from a request's tool messages. */
const resultNamed = (
	results: unknown[],
	name: string,
): Record<string, unknown> => {
	const found = results.find(
		(result) => isRecord(result) && result.name === name,
	);
	if (!isRecord(found)) throw new Error(`No tool result names ${name}`);

	return found;
};

test("assistant: a member sets up and publishes a bot in one turn, and the next turn reads those calls as summary lines", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const asset = await member.asset.create(assetRow(chatName("Syllabus")));
	const templateName = chatName("Template");
	const repositoryName = chatName("Repository");
	const botName = chatName("Bot");
	const done = "Your bot is published.";
	await approvePlan(member, chatId, inference, {
		title: "Set up the syllabus bot",
		items: [
			"Create the template and repository",
			"Create the bot",
			"Publish the bot",
		],
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);

	inference.script(
		loadTools("bots"),
		{
			toolCalls: [
				{
					name: "createTemplate",
					input: {
						name: templateName,
						systemPrompt: "Answer questions about the course syllabus.",
						status: "ready",
					},
				},
				{
					name: "createRepository",
					input: {
						name: repositoryName,
						status: "ready",
						assetIds: [
							asset.data.id,
						],
					},
				},
			],
		},
		// Held, so the next steps can use the ids the creates returned.
		{
			toolCalls: [
				{
					name: "findBlocks",
					input: {
						type: "repository",
						query: repositoryName,
					},
				},
			],
			hold: "response",
		},
	);
	await ask(page, "Set up a syllabus bot and publish it");

	const saved = toolMessages(await heldTurnRequest(inference, 3));
	const template = resultNamed(saved, templateName);
	const repository = resultNamed(saved, repositoryName);
	expect(template).toMatchObject({
		type: "template",
		status: "ready",
	});
	expect(repository).toMatchObject({
		type: "repository",
		assetCount: 1,
	});
	const templateId = template.id as BlockId;
	const repositoryId = repository.id as BlockId;
	const loadedLine = message("assistant_tool_load_tools_summary", {
		groups: message("assistant_tool_group_bots"),
	});
	// The turn in progress keeps its outputs in full.
	expect(saved).toContainEqual(
		expect.objectContaining({
			groups: [
				expect.objectContaining({
					group: "bots",
					loaded: true,
				}),
			],
		}),
	);

	inference.script(
		{
			toolCalls: [
				{
					name: "createBot",
					input: {
						name: botName,
						description: "Answers syllabus questions.",
						templateId,
						repositoryIds: [
							repositoryId,
						],
						features: {
							generativeUi: {},
						},
					},
				},
			],
		},
		{
			toolCalls: [
				{
					name: "findBots",
					input: {
						query: botName,
					},
				},
			],
			hold: "response",
		},
	);
	inference.release();

	const created = toolMessages(await heldTurnRequest(inference, 5));
	const createdBot = resultNamed(created, botName);
	expect(createdBot).toMatchObject({
		type: "bot",
		status: "draft",
		features: {
			generativeUi: {},
		},
	});
	expect(createdBot).not.toHaveProperty("created");
	const botId = createdBot.id as BotId;
	const templateLine = message("assistant_tool_create_template_summary", {
		name: quoted(templateName),
	});
	expect(created).toContainEqual(template);

	inference.script(
		{
			toolCalls: [
				{
					name: "publishBot",
					input: {
						id: botId,
					},
				},
			],
		},
		{
			text: done,
		},
	);
	inference.release();

	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(7);
	expect(offeredTools(requests[1])).toEqual(expect.arrayContaining(BOTS_TOOLS));
	// Read after the save in the same turn, so the draft is already visible.
	expect(toolMessages(requests[5]).at(-1)).toMatchObject({
		total: 1,
	});
	expect(toolMessages(requests[6]).at(-1)).toMatchObject({
		type: "bot",
		id: botId,
		status: "ready",
	});

	// No cookie carries a streamed turn's writes; its settled zedToken does.
	let zedToken: string | undefined;
	await expect
		.poll(async () => {
			zedToken = (await lastRow(member, chatId)).zedToken;
			return zedToken;
		})
		.toBeDefined();
	zedTokens.write(zedToken as string);
	const { data: bot } = await member.bot.findEditor({
		id: botId,
	});
	expect(bot).toMatchObject({
		name: botName,
		status: "ready",
		features: {
			generativeUi: {},
		},
		templateBlock: {
			id: templateId,
		},
	});
	expect(bot.databaseBlocks.map((block) => block.id)).toEqual([
		repositoryId,
	]);
	const { assets } = await member.block.find({
		id: repositoryId,
	});
	expect(assets?.map((attached) => attached.id)).toEqual([
		asset.data.id,
	]);

	await expandWorkLog(page);
	const log = page.getByRole("log");
	const botLine = message("assistant_tool_create_bot_summary", {
		name: quoted(botName),
	});
	for (const line of [
		loadedLine,
		templateLine,
		message("assistant_tool_create_repository_summary", {
			name: quoted(repositoryName),
		}),
		botLine,
		message("assistant_tool_publish_bot_summary", {
			name: quoted(botName),
		}),
	]) {
		await expect(
			log.getByText(line, {
				exact: true,
			}),
		).toBeVisible();
	}
	await expect(
		log.getByText(message("chat_work_log_tool_status_failed"), {
			exact: true,
		}),
	).toHaveCount(0);

	inference.reset();
	const thanks = "You are welcome.";
	inference.script({
		text: thanks,
	});
	await ask(page, "Thanks");
	await expect(messageText(page, thanks)).toBeVisible();
	await turnFinished(page);

	const [next] = turnRequests(inference);
	expect(historyToolCallsOf(next)).toEqual(
		expect.arrayContaining([
			"createTemplate",
			"createRepository",
			"createBot",
			"publishBot",
		]),
	);
	// The group loaded in the earlier turn stays loaded.
	expect(offeredTools(next)).toEqual(expect.arrayContaining(BOTS_TOOLS));
	expect(toolResultsOf(next)).toContain(botLine);
	expect(toolMessages(next)).not.toContainEqual(createdBot);
});
