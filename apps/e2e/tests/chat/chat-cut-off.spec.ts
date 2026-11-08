import type { Page } from "@playwright/test";
import {
	chatName,
	composer,
	createChat,
	messageCount,
	messageText,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const PARTIAL = "The first half";

const send = async (page: Page, text: string) => {
	await composer(page).fill(text);
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
			exact: true,
		})
		.click();
};

const cutOffNotice = (page: Page) =>
	page.getByRole("log").getByText(message("chat_message_interrupted"), {
		exact: true,
	});

test("a stream that breaks off after some text keeps the reply, marked cut off", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Cut Off"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script({
		text: PARTIAL,
		cutOff: true,
	});
	await send(page, "Tell me everything.");

	await expect(messageText(page, PARTIAL)).toBeVisible();
	await expect(cutOffNotice(page)).toBeVisible();
	await turnFinished(page);
	await expect.poll(() => messageCount(member, chatId)).toBe(2);

	await page.reload();
	await expect(messageText(page, PARTIAL)).toBeVisible();
	await expect(cutOffNotice(page)).toBeVisible();
});

test("a stream that breaks off before any text stays an error", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Cut Early"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script({
		text: "",
		cutOff: true,
	});
	await send(page, "Tell me everything.");

	await expect(
		page.getByRole("alert").getByText(message("chat_response_failed"), {
			exact: true,
		}),
	).toBeVisible();
	await turnFinished(page);
	await expect(cutOffNotice(page)).toHaveCount(0);
	await expect.poll(() => messageCount(member, chatId)).toBe(1);
});
