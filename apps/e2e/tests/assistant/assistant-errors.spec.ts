import { uploadAsset } from "../../fixtures/assets";
import {
	continueTurn,
	lastRow,
	loadTools,
	pauseTurn,
	pendingApprovalIds,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	expandWorkLog,
	openConversation,
	setUpAssistantModel,
	startTitledConversation,
	toolResultsOf,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import { approvePlan } from "../../fixtures/assistant/plan";
import { ask, chatName, messageText } from "../../fixtures/chat/chat";
import { createBot } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

test("assistant: an approved grant on a bot the member cannot manage fails with the denial", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const bot = await createBot(api.as("admin"));
	const relayed = "You do not have permission to share that bot.";

	inference.script(loadTools("sharing"), {
		toolCalls: [
			{
				name: "grantAccess",
				input: {
					resourceType: "bot",
					resourceId: bot.id,
					principals: [
						{
							principalType: "user",
							principalId: org.users.viewer.id,
						},
					],
					role: "editor",
				},
			},
		],
	});
	const paused = await pauseTurn(
		member,
		chatId,
		`Give the viewer edit access to ${bot.name}`,
	);
	expect(paused.role).toBe("assistant");
	const [approvalId] = pendingApprovalIds(paused);
	if (!approvalId) throw new Error("The reply did not pause");

	inference.reset();
	inference.script({
		text: relayed,
	});
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
	).toBe(relayed);

	const [request] = turnRequests(inference);
	expect(toolResultsOf(request).at(-1)).toContain("PERMISSION_DENIED: ");

	const resumed = await lastRow(member, chatId);
	expect(resumed.id).toBe(paused.id);
	expect(toolParts(resumed, "grantAccess")[0]).toMatchObject({
		state: "output-error",
		errorText: expect.stringMatching(/^PERMISSION_DENIED: /),
	});

	const grants = await api.as("admin").resource.listGrants({
		resourceType: "bot",
		resourceId: bot.id,
	});
	expect(
		grants.data.filter(
			(grant) =>
				grant.principalId === org.users.viewer.id && grant.revokedAt === null,
		),
	).toHaveLength(0);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await expect(messageText(page, relayed)).toBeVisible();
	await expandWorkLog(page);
	const log = page.getByRole("log");
	await expect(
		log.getByText(message("chat_work_log_tool_status_failed"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		log.getByText(message("error_permission_denied"), {
			exact: true,
		}),
	).toBeVisible();
});

test("assistant: attaching an asset the member cannot read relays ASSET_LINK_FORBIDDEN", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const foreign = await uploadAsset(
		api.as("manager"),
		chatName("Private Asset"),
	);
	const name = chatName("Repository");
	const relayed = "You cannot attach that asset.";
	await approvePlan(member, chatId, inference, {
		title: "Set up the repository",
		items: [
			"Create the repository",
		],
	});

	inference.script(
		loadTools("bots"),
		{
			toolCalls: [
				{
					name: "createRepository",
					input: {
						name,
						assetIds: [
							foreign.id,
						],
					},
				},
			],
		},
		{
			text: relayed,
		},
	);
	expect(await ask(member, chatId, "Make a repository with that asset")).toBe(
		relayed,
	);

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(3);
	expect(toolResultsOf(requests[2]).at(-1)).toContain("ASSET_LINK_FORBIDDEN: ");

	const repositories = await member.block.list({
		pageIndex: 0,
		pageSize: 10,
		filters: {
			type: "database",
			status: "draft",
			search: name,
		},
	});
	expect(repositories.data).toHaveLength(0);
});

test("assistant: a call with invalid input fails with INVALID_TOOL_INPUT and the turn goes on", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const relayed = "That id was not valid.";

	inference.script(
		{
			toolCalls: [
				{
					name: "getBot",
					input: {
						id: "not-a-bot-id",
					},
				},
			],
		},
		{
			text: relayed,
		},
	);
	expect(await ask(member, chatId, "Show me that bot")).toBe(relayed);
	expect(turnRequests(inference)).toHaveLength(2);

	const [failed] = toolParts(await lastRow(member, chatId), "getBot");
	expect(failed).toMatchObject({
		state: "output-error",
		errorText: expect.stringMatching(/^INVALID_TOOL_INPUT: /),
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await expect(messageText(page, relayed)).toBeVisible();
	await expandWorkLog(page);
	const log = page.getByRole("log");
	await expect(
		log.getByText(message("error_invalid_tool_input"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		log.getByText(message("error_ai_stream_failed"), {
			exact: true,
		}),
	).toHaveCount(0);
});
