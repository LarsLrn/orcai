import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("bots: the detail page shows its frequent actions inline and keeps Delete behind the menu", async ({
	api,
	org,
	pageAs,
}) => {
	const { data: bot } = await api.as("member").bot.save({
		name: `E2E Detail Actions Bot ${runId()}`,
		description: "Created by the detail actions spec.",
		status: "ready",
		templateBlockId: null,
		databaseBlockIds: [],
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}`);
	const title = page.getByRole("heading", {
		name: bot.name,
	});
	await expect(title).toBeVisible();
	// The store header names the kind and the owner, the current user as "You".
	await expect(
		page.getByText(message("resource_kind_bot"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(
			`${message("resource_owner_label")} ${message("resource_owner_you")}`,
		),
	).toBeVisible();

	const startChat = page.getByRole("link", {
		name: message("bots_detail_start_chat_action"),
	});
	const edit = page.getByRole("link", {
		name: message("bots_edit_action"),
	});
	const access = page.getByRole("button", {
		name: message("bots_access_action"),
	});
	const moreActions = page.getByRole("button", {
		name: message("common_more_actions"),
	});
	await expect(startChat).toBeVisible();
	await expect(edit).toBeVisible();
	await expect(access).toBeVisible();
	await expect(page.getByText(message("bots_delete_action"))).toHaveCount(0);

	await moreActions.click();
	await expect(page.getByRole("menuitem")).toHaveText([
		message("access_list_action"),
		message("bots_delete_action"),
	]);

	// Listing sits in the menu and confirms first; afterwards the menu offers to take it out.
	await page
		.getByRole("menuitem", {
			name: message("access_list_action"),
		})
		.click();
	const confirmListing = page.getByRole("alertdialog");
	await expect(
		confirmListing.getByText(message("access_publish_confirm_description")),
	).toBeVisible();
	await confirmListing
		.getByRole("button", {
			name: message("access_publish_confirm_button"),
		})
		.click();
	await expect(confirmListing).toBeHidden();
	await moreActions.click();
	await expect(page.getByRole("menuitem")).toHaveText([
		message("access_unlist_action"),
		message("bots_delete_action"),
	]);
	await page.keyboard.press("Escape");

	// Narrow, the menu stays in the title row and the buttons move below it.
	await page.setViewportSize({
		width: 390,
		height: 844,
	});
	const titleBox = await title.boundingBox();
	const menuBox = await moreActions.boundingBox();
	const editBox = await edit.boundingBox();
	if (!(titleBox && menuBox && editBox)) throw new Error("not laid out");
	expect(menuBox.y).toBeLessThan(titleBox.y + titleBox.height);
	expect(menuBox.x).toBeGreaterThan(titleBox.x);
	expect(editBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
});
