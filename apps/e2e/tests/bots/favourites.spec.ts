import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const star = (page: Page, name: string) =>
	page.getByRole("button", {
		name: message("bots_favourite_toggle_label", {
			name,
		}),
	});

test("bots: a starred bot shows in the library's and the selector's favourites", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const { data: bot } = await member.bot.save({
		name: `E2E Favourite Bot ${runId()}`,
		description: "Created by the favourites spec.",
		status: "ready",
		behaviourId: null,
		repositoryIds: [],
	});
	// The chat tour's card would cover the chat the bot starts.
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	const favourites = `/app/library/bots?favourite=true&query=${encodeURIComponent(bot.name)}`;
	await open(page, favourites);
	await expect(star(page, bot.name)).toHaveCount(0);

	await open(page, `/app/library/bots?query=${encodeURIComponent(bot.name)}`);
	await star(page, bot.name).click();
	await expect(star(page, bot.name)).toHaveAttribute("aria-pressed", "true");
	await open(page, favourites);
	await expect(star(page, bot.name)).toHaveAttribute("aria-pressed", "true");

	await open(page, "/app/chat/new");
	await page
		.getByRole("button", {
			name: message("chat_bot_selector_no_bot_title"),
		})
		.click();
	const selector = page.getByRole("dialog", {
		name: message("chat_bot_selector_dialog_title"),
	});
	await expect(
		selector
			.getByRole("group", {
				name: message("bots_favourites_group_label"),
			})
			.getByRole("option", {
				name: bot.name,
			}),
	).toBeVisible();
	await page.keyboard.press("Escape");

	await open(page, favourites);
	await star(page, bot.name).click();
	await expect(star(page, bot.name)).toHaveCount(0);
	await expect(
		page.getByText(message("browse_no_results_title")),
	).toBeVisible();
});
