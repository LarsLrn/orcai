import type { Page } from "@playwright/test";
import {
	chatName,
	createChat,
	messageText,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const REPLY = "Photosynthesis turns light into chemical energy.";

const openRatingMenu = async (page: Page) => {
	await page
		.getByRole("log")
		.getByRole("button", {
			name: message("chat_message_rate_action_label"),
		})
		.click();
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	return menu;
};

const option = (page: Page, key: string) =>
	page.getByRole("menuitemradio", {
		name: message(key),
	});

const rate = async (page: Page, key: string) => {
	await openRatingMenu(page);
	await option(page, key).click();
	await expect(
		page.getByText(message("chat_message_rate_toast_success")),
	).toBeVisible();
};

const expectRating = async (page: Page, key: string | null) => {
	await page.reload();
	await expect(messageText(page, REPLY)).toBeVisible();
	await openRatingMenu(page);
	await expect(
		page.getByRole("menuitemradio", {
			checked: true,
		}),
	).toHaveCount(key ? 1 : 0);
	if (key) await expect(option(page, key)).toBeChecked();
	await page.keyboard.press("Escape");
};

test("chat: a rating survives a reload, can be changed, and cleared", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
	const chatId = await createChat(member, model, chatName("Rating"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "What does photosynthesis do?",
			reply: REPLY,
		},
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	await rate(page, "chat_message_rate_option_very_much");
	await expectRating(page, "chat_message_rate_option_very_much");

	await rate(page, "chat_message_rate_option_not_really");
	await expectRating(page, "chat_message_rate_option_not_really");

	await rate(page, "chat_message_rate_option_not_really");
	await expectRating(page, null);

	const { data } = await member.chatMessage.listRatings({
		chatId,
	});
	expect(data).toEqual([]);
});
