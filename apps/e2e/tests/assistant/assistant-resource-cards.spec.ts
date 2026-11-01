import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import {
	createdBotId,
	lastRow,
	loadTools,
} from "../../fixtures/assistant/approval";
import {
	openConversation,
	setUpAssistantModel,
	startTitledConversation,
} from "../../fixtures/assistant/assistant";
import { approvePlan } from "../../fixtures/assistant/plan";
import { chatName, messageText, turnFinished } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const DONE = "The course bot is ready.";

/** The card of a resource the assistant wrote, by the title it shows. */
const resourceCard = (page: Page, title: string) =>
	page.getByRole("log").getByRole("group", {
		name: title,
		exact: true,
	});

const openLink = (page: Page) =>
	page.getByRole("log").getByRole("link", {
		name: message("assistant_resource_card_open_action"),
	});

/** A conversation past plan mode whose next turn creates the bot `name`. */
const scriptBotCreation = async (
	member: ApiClient,
	inference: InferenceMock,
	name: string,
): Promise<ChatId> => {
	const chatId = await startTitledConversation(member, inference);
	await approvePlan(member, chatId, inference, {
		title: "Set up the course bot",
		items: [
			"Create the course bot",
		],
	});
	inference.script(
		loadTools("bots"),
		{
			toolCalls: [
				{
					name: "createBot",
					input: {
						name,
						description: "Set up by the resource card spec.",
					},
				},
			],
		},
		{
			text: DONE,
		},
	);

	return chatId;
};

test("assistant: a created bot's card opens the bot once the turn's writes reach the browser", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const name = chatName("Course Bot");
	const chatId = await scriptBotCreation(member, inference, name);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	let release: () => void = () => undefined;
	const handover = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/ai/recordTurnWrites", async (route) => {
		await handover;
		await route.continue();
	});
	await ask(page, "Create the course bot");
	await expect(messageText(page, DONE)).toBeVisible();

	// Until the handover lands, the card names the bot without a way to open it.
	const card = resourceCard(page, name);
	await expect(card).toContainText(message("resource_kind_bot"));
	await expect(openLink(page)).toHaveCount(0);

	release();
	await turnFinished(page);
	const botId = createdBotId(await lastRow(member, chatId));
	await card
		.getByRole("link", {
			name: message("assistant_resource_card_open_action"),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/app/library/bots/${botId}$`));
	await expect(
		page.getByRole("heading", {
			name,
			level: 1,
		}),
	).toBeVisible();

	await openConversation(page, chatId);
	await expect(card).toContainText(message("resource_kind_bot"));
});

test("assistant: the card of a deleted bot no longer names or opens it", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const name = chatName("Deleted Bot");
	const chatId = await scriptBotCreation(member, inference, name);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Create the course bot");
	await expect(messageText(page, DONE)).toBeVisible();
	await turnFinished(page);
	await expect(openLink(page)).toBeVisible();

	const reply = await lastRow(member, chatId);
	// The API client reads after the turn the browser ran.
	if (reply.zedToken) zedTokens.write(reply.zedToken);
	await member.bot.delete({
		refs: [
			{
				id: createdBotId(reply),
			},
		],
	});
	await openConversation(page, chatId);

	const gone = resourceCard(
		page,
		message("assistant_resource_card_unavailable"),
	);
	await expect(gone).toContainText(message("resource_kind_bot"));
	await expect(gone).not.toContainText(name);
	await expect(openLink(page)).toHaveCount(0);
});
