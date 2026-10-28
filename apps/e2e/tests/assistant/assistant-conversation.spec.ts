import type { Page } from "@playwright/test";
import {
	composerModel,
	conversationLog,
	createMockModel,
	historyEntry,
	lastTurnModel,
	openAssistant,
	openConversation,
	reasonOf,
	setAssistantModel,
	setUpAssistantModel,
	startConversation,
	turnRefusal,
} from "../../fixtures/assistant/assistant";
import {
	branchActions,
	chatName,
	chatTitleMenu,
	composer,
	messageText,
	sendTurn,
} from "../../fixtures/chat/chat";
import { ROLES } from "../../fixtures/constants";
import {
	expect,
	INFERENCE_MOCK_MODELS,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const submit = (page: Page) =>
	page.getByRole("button", {
		name: message("ai_elements_prompt_input_submit_aria_label"),
	});

for (const role of ROLES.filter((role) => role !== "manager")) {
	test(`assistant: ${role === "admin" ? "an" : "a"} ${role} starts a conversation and gets a reply`, async ({
		api,
		inference,
		org,
		pageAs,
	}) => {
		await setUpAssistantModel(api, org, inference);
		const question = `Where do I start as ${role}?`;
		const reply = `Start on the home page, ${role}.`;

		const page = await pageAs(role);
		await enterApp(page, org.slug);
		await openAssistant(page);

		inference.respondWith({
			text: reply,
		});
		await composer(page).fill(question);
		await submit(page).click();

		await expect(page).toHaveURL(/\/app\/assistant\/[0-9a-f-]{36}(\?|$)/);
		await expect(messageText(page, reply)).toBeVisible();
		expect(lastTurnModel(inference)).toBe(INFERENCE_MOCK_MODELS.chat);

		const chatId = new URL(page.url()).pathname.split("/").at(-1);
		const listed = await api.as(role).assistant.list({
			pageIndex: 0,
			pageSize: 100,
		});
		expect(listed.data.map((chat) => chat.id)).toContain(chatId);
	});
}

test("assistant: a conversation is titled, shows its model, hides chat-only controls and stays out of the chat lists", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const { data: modelRow } = await member.model.find({
		id: model.modelId,
	});
	const chatId = await startConversation(member);
	const turn = {
		question: "How do I invite a colleague?",
		reply: "Inviting colleagues",
	};

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn,
	});
	await expect
		.poll(
			async () =>
				(
					await member.chat.find({
						id: chatId,
					})
				).data.title,
		)
		.toBe(turn.reply);

	const chats = await member.chat.list({
		pageIndex: 0,
		pageSize: 100,
	});
	expect(chats.data.map((chat) => chat.id)).not.toContain(chatId);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await expect(messageText(page, turn.reply)).toBeVisible();
	await expect(composerModel(page, modelRow.name)).toBeVisible();

	await expect(branchActions(page)).toHaveCount(0);
	await expect(
		page.getByRole("button", {
			name: message("chat_attachment_menu_trigger"),
		}),
	).toHaveCount(0);
	// The reply's usage badge names the model too, so only an exact match is a selector.
	await expect(
		page.getByRole("button", {
			name: modelRow.name,
			exact: true,
		}),
	).toHaveCount(0);
	// The title menu offers what an assistant conversation supports.
	await expect(chatTitleMenu(page)).toHaveText(turn.reply);
	await chatTitleMenu(page).click();
	await expect(page.getByRole("menuitem")).toHaveText([
		message("chat_actions_rename_action"),
		message("chat_actions_download_action"),
		message("chat_actions_delete_action"),
	]);
	await page.keyboard.press("Escape");

	// Neither the chat sidebar nor the chat list links to it.
	const chatLink = page.locator(`a[href="/app/chat/${chatId}"]`);
	await expect(chatLink).toHaveCount(0);
	await open(page, "/app/chat");
	await expect(
		page.getByRole("heading", {
			name: message("chat_list_page_title"),
		}),
	).toBeVisible();
	await expect(chatLink).toHaveCount(0);

	await open(page, "/app/assistant");
	await expect(historyEntry(page, turn.reply)).toBeVisible();
});

test("assistant: the history lists the most recently active first and renames and deletes", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const older = chatName("Older");
	const newer = chatName("Newer");
	const olderId = await startConversation(member);
	const newerId = await startConversation(member);
	await member.chat.update({
		id: newerId,
		title: newer,
	});
	await member.chat.update({
		id: olderId,
		title: older,
	});
	// A turn makes the older conversation the most recently active.
	await sendTurn({
		client: member,
		inference,
		chatId: olderId,
		turn: {
			question: "Still there?",
			reply: "Yes.",
		},
	});

	const listed = await member.assistant.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const ids = listed.data.map((chat) => chat.id);
	expect(ids.indexOf(olderId)).toBeLessThan(ids.indexOf(newerId));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openAssistant(page);
	await expect(historyEntry(page, older)).toBeVisible();
	await expect(historyEntry(page, newer)).toBeVisible();

	const history = page.getByRole("region", {
		name: message("assistant_history_title"),
	});
	const titles = await history.getByRole("link").allTextContents();
	expect(titles.findIndex((title) => title.includes(older))).toBeLessThan(
		titles.findIndex((title) => title.includes(newer)),
	);

	const renamed = chatName("Renamed");
	const row = history.getByRole("listitem").filter({
		has: page.getByRole("link", {
			name: newer,
			exact: true,
		}),
	});
	await row
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("chat_actions_rename_action"),
		})
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("textbox").fill(renamed);
	await dialog
		.getByRole("button", {
			name: message("chat_rename_dialog_submit"),
		})
		.click();
	await expect(historyEntry(page, renamed)).toBeVisible();

	const renamedRow = history.getByRole("listitem").filter({
		has: page.getByRole("link", {
			name: renamed,
			exact: true,
		}),
	});
	await renamedRow
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("chat_actions_delete_action"),
		})
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", {
			name: message("chat_actions_delete_action"),
		})
		.click();
	await expect(historyEntry(page, renamed)).toHaveCount(0);
	await expect
		.poll(async () =>
			(
				await member.assistant.list({
					pageIndex: 0,
					pageSize: 100,
				})
			).data.map((chat) => chat.id),
		)
		.not.toContain(newerId);
});

test("assistant: switching the organisation's model applies to the next turn", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startConversation(member);
	const first = {
		question: "First question",
		reply: "First answer.",
	};

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: first,
	});
	expect(lastTurnModel(inference)).toBe(INFERENCE_MOCK_MODELS.chat);

	const next = await createMockModel(api.as("admin"), model.providerId);
	await setAssistantModel(api.as("admin"), org, next.modelId);

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Second question",
			reply: "Second answer.",
		},
	});
	expect(lastTurnModel(inference)).toBe(next.providerModelId);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await expect(composerModel(page, next.name)).toBeVisible();
});

test("assistant: the chat route of a conversation redirects to the assistant", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const chatId = await startConversation(api.as("member"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/chat/${chatId}`);

	await expect(page).toHaveURL(new RegExp(`/app/assistant/${chatId}`));
	await expect(conversationLog(page)).toBeVisible();
});

test("assistant: the quota status and refusals follow the pool of the assistant model", async ({
	api,
	inference,
	org,
}) => {
	const model = await setUpAssistantModel(api, org, inference);
	const admin = api.as("admin");
	const groups = await admin.group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(group) => group.systemKey === "all_members",
	);
	if (!allMembers) throw new Error("Missing All Members group");
	const poolName = chatName("Assistant Pool");
	await admin.quota.create({
		name: poolName,
		providerId: model.providerId,
		modelId: model.modelId,
		periodType: "monthly",
		budgetAmount: 1,
		groupIds: [
			allMembers.id,
		],
	});

	const member = api.as("member");
	const chatId = await startConversation(member);
	const status = await member.quota.status({
		providerId: model.providerId,
		modelId: model.modelId,
	});
	expect(status.data.pool?.name).toBe(poolName);

	expect(reasonOf(await turnRefusal(member, chatId))).toBe("QUOTA_EXHAUSTED");
});
