import type { Page } from "@playwright/test";
import { chatName } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const sidebarGroup = (page: Page, key: string) =>
	page.getByRole("group", {
		name: message(key),
		exact: true,
	});

const chooseAction = async (page: Page, title: string, action: string) => {
	await page
		.getByRole("button", {
			name: message("sidebar_chat_actions_aria_label", {
				title,
			}),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message(action),
		})
		.click();
};

test("pinning moves a chat to the pinned section, where it stays", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const pinnedTitle = chatName("Pinned");
	const otherTitle = chatName("Recent");
	await member.chat.create({
		title: pinnedTitle,
	});
	await member.chat.create({
		title: otherTitle,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	const pinned = sidebarGroup(page, "sidebar_chats_pinned_group_label");
	const recent = sidebarGroup(page, "sidebar_chats_group_label");
	await expect(pinned).toHaveCount(0);
	await expect(
		recent.getByRole("link", {
			name: pinnedTitle,
		}),
	).toBeVisible();

	await chooseAction(page, pinnedTitle, "chat_actions_pin_action");
	await expect(
		pinned.getByRole("link", {
			name: pinnedTitle,
		}),
	).toBeVisible();
	await expect(
		recent.getByRole("link", {
			name: pinnedTitle,
		}),
	).toHaveCount(0);

	await page.reload();
	await expect(
		pinned.getByRole("link", {
			name: pinnedTitle,
		}),
	).toBeVisible();
	await expect(
		recent.getByRole("link", {
			name: otherTitle,
		}),
	).toBeVisible();

	// The chat list leads with it too, marked as pinned.
	await open(page, "/app/chat");
	const firstRow = page.getByRole("main").getByRole("row").nth(1);
	await expect(
		firstRow.getByRole("link", {
			name: pinnedTitle,
		}),
	).toBeVisible();
	await expect(
		firstRow.getByRole("img", {
			name: message("chat_pinned_label"),
		}),
	).toBeVisible();

	await chooseAction(page, pinnedTitle, "chat_actions_unpin_action");
	await expect(pinned).toHaveCount(0);
	await expect(
		recent.getByRole("link", {
			name: pinnedTitle,
		}),
	).toBeVisible();
});
