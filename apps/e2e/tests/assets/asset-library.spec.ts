import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const card = (page: Page, title: string) =>
	page.locator('[data-slot="tile"]').filter({
		hasText: title,
	});

/** An "Uploaded to" choice in the rail. */
const uploadedTo = (page: Page, key: string) =>
	page
		.getByRole("group", {
			name: message("library_filter_origin_label"),
		})
		.getByRole("radio", {
			name: message(key),
		});

test("assets: chat uploads have their own filter until added to the library", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const libraryTitle = `E2E Library ${runId()}`;
	const chatTitle = `E2E Chat Upload ${runId()}`;
	await uploadAsset(member, libraryTitle);
	await uploadAsset(member, chatTitle, {
		route: "chatAttachment",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/library/assets");

	await expect(uploadedTo(page, "library_filter_origin_library")).toBeChecked();
	await expect(card(page, libraryTitle)).toBeVisible();
	await expect(card(page, chatTitle)).toHaveCount(0);

	await uploadedTo(page, "library_filter_origin_chat").click();
	await expect(page).toHaveURL(/origin=chat/);
	const chatCard = card(page, chatTitle);
	await expect(chatCard).toBeVisible();
	await expect(
		chatCard.getByText(message("assets_origin_chat_badge"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(card(page, libraryTitle)).toHaveCount(0);

	await chatCard
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("assets_add_to_library_action"),
		})
		.click();
	await expect(chatCard).toHaveCount(0);

	await uploadedTo(page, "library_filter_origin_library").click();
	await expect(page).not.toHaveURL(/origin=/);
	const added = card(page, chatTitle);
	await expect(added).toBeVisible();
	await expect(
		added.getByText(message("assets_origin_chat_badge"), {
			exact: true,
		}),
	).toHaveCount(0);
});
