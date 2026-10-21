import type { Page } from "@playwright/test";
import { createAccountUser } from "../../fixtures/account/users";
import { zedTokenOf } from "../../fixtures/api";
import { pageForSession } from "../../fixtures/auth/users";
import {
	chatName,
	composer,
	createChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

const moreActions = (page: Page) =>
	page.getByRole("button", {
		name: message("chat_composer_more_actions_aria_label"),
	});

const tourCard = (page: Page) =>
	page.getByRole("dialog", {
		name: message("tour_chat_intro_title"),
	});

test("chat: the composer menu starts the chat tour until the user has seen it", async ({
	api,
	appBaseURL,
	browser,
	inference,
}) => {
	const model = await setUpChatModel(api, inference);
	// A fresh user, because the tour state is the user's and outlives a spec.
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "chat-tour",
		admin: api.as("admin"),
	});
	const chatId = await createChat(user.api, model, chatName("Tour"));
	const { context, page } = await pageForSession(browser, user.session);

	try {
		// The browser session has not seen the chat's grant yet.
		await open(
			page,
			`/app/chat/${chatId}?zedToken=${encodeURIComponent(zedTokenOf(user.api) ?? "")}`,
		);
		await expect(composer(page)).toBeVisible();

		await moreActions(page).click();
		await expect(tourCard(page)).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: message("common_next_button"),
			}),
		).toBeFocused();

		for (const _ of [
			1,
			2,
		]) {
			await page
				.getByRole("button", {
					name: message("common_next_button"),
				})
				.click();
		}
		await page
			.getByRole("button", {
				name: message("tour_card_finish_button"),
			})
			.click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		// Focus returns to the menu's trigger the tour started from.
		await expect(moreActions(page)).toBeFocused();

		await expect
			.poll(async () => (await user.api.user.me({})).data.preferences?.tours)
			.toEqual({
				chatTour: "completed",
			});

		// Reopening the menu right away must not start the finished tour again.
		await moreActions(page).click();
		const startTour = page.getByRole("menuitem", {
			name: message("chat_composer_start_tour_action"),
		});
		await expect(startTour).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);

		// It still starts on request, and Escape skips it.
		await startTour.click();
		await expect(tourCard(page)).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect
			.poll(async () => (await user.api.user.me({})).data.preferences?.tours)
			.toEqual({
				chatTour: "skipped",
			});
	} finally {
		await context.close();
	}
});
