import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const section = (page: Page, titleKey: string) =>
	page.locator("section", {
		has: page.getByRole("heading", {
			name: message(titleKey),
			exact: true,
		}),
	});

const star = (page: Page, titleKey: string, name: string) =>
	section(page, titleKey).getByRole("button", {
		name: message("bots_favourite_toggle_label", {
			name,
		}),
	});

test("bots: a starred bot shows in the hub's and the selector's favourites", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const { data: bot } = await member.bot.save({
		name: `E2E Favourite Bot ${runId()}`,
		description: "Created by the favourites spec.",
		status: "ready",
		templateBlockId: null,
		databaseBlockIds: [],
	});
	// The chat tour's card swallows the clicks on the composer's menu.
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/hub/bots");
	const favourites = section(page, "bots_list_favourites_title");
	await expect(favourites).toHaveCount(0);

	await star(page, "bots_list_published_title", bot.name).click();
	await expect(favourites.getByText(bot.name)).toBeVisible();
	await expect(
		star(page, "bots_list_favourites_title", bot.name),
	).toHaveAttribute("aria-pressed", "true");
	await expect(
		star(page, "bots_list_published_title", bot.name),
	).toHaveAttribute("aria-pressed", "true");

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

	await open(page, "/app/hub/bots");
	await star(page, "bots_list_favourites_title", bot.name).click();
	await expect(favourites).toHaveCount(0);
	await expect(
		star(page, "bots_list_published_title", bot.name),
	).toHaveAttribute("aria-pressed", "false");
});
