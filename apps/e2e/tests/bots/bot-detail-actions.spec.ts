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
	await open(page, `/app/hub/bots/${bot.id}`);
	const title = page.getByRole("heading", {
		name: bot.name,
	});
	await expect(title).toBeVisible();

	const startChat = page.getByRole("link", {
		name: message("bots_detail_start_chat_action"),
	});
	const edit = page.getByRole("link", {
		name: message("bots_detail_edit_action"),
	});
	const access = page.getByRole("button", {
		name: message("bots_detail_access_action"),
	});
	const moreActions = page.getByRole("button", {
		name: message("common_more_actions"),
	});
	await expect(startChat).toBeVisible();
	await expect(edit).toBeVisible();
	await expect(access).toBeVisible();
	await expect(
		page.getByText(message("bots_detail_delete_action")),
	).toHaveCount(0);

	await moreActions.click();
	await expect(page.getByRole("menuitem")).toHaveText([
		message("bots_detail_delete_action"),
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
