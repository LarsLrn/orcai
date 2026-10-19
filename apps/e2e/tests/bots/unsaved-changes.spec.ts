import type { Page } from "@playwright/test";
import { type Api, expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const leaveDialog = (page: Page) =>
	page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_title"),
	});

const homeLink = (page: Page) =>
	page.getByRole("link", {
		name: message("sidebar_logo_home_link_label"),
	});

const nameField = (page: Page) =>
	page.getByLabel(message("authoring_basics_name_label"));

test("bots: stay keeps a new bot's unsaved name", async ({ org, pageAs }) => {
	const name = `E2E Unsaved Bot ${runId()}`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/hub/bots/add");
	await nameField(page).fill(name);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();

	await expect(leaveDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/app\/hub\/bots\/add/);
	await expect(nameField(page)).toHaveValue(name);
});

test("bots: saving and changing steps never ask, leaving with edits does", async ({
	org,
	pageAs,
}) => {
	const name = `E2E Unsaved Bot ${runId()}`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/hub/bots/add");
	await nameField(page).fill(name);
	await page
		.getByLabel(message("authoring_basics_description_label"))
		.fill("Created by the unsaved changes spec.");

	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/hub\/bots\/[^/]+\/setup\?step=1/);
	await expect(
		page.getByRole("heading", {
			name: message("bots_setup_page_title"),
		}),
	).toBeVisible();

	await page
		.getByRole("button", {
			name: message("authoring_wizard_step_basics_title"),
		})
		.click();
	await nameField(page).fill(`${name} renamed`);
	await page
		.getByRole("button", {
			name: message("authoring_wizard_step_behaviour_title"),
		})
		.click();
	await expect(page).toHaveURL(/step=1/);
	await expect(leaveDialog(page)).toHaveCount(0);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_leave_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/?$/);
});

const memberBot = async (api: Api, withTemplate = false) => {
	const member = api.as("member");
	const template = withTemplate
		? await member.block.create({
				type: "template",
				name: `E2E Unsaved Template ${runId()}`,
				status: "ready",
				config: {
					systemPrompt: "Created by the unsaved changes spec.",
				},
			})
		: undefined;
	const bot = await member.bot.save({
		name: `E2E Unsaved Bot ${runId()}`,
		description: "Created by the unsaved changes spec.",
		status: "draft",
		templateBlockId: template?.data.id ?? null,
		databaseBlockIds: [],
	});

	return bot.data;
};

test("bots: closing the upload dialog with an uploaded file asks first", async ({
	api,
	org,
	pageAs,
}) => {
	const bot = await memberBot(api);
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/bots/${bot.id}/setup?step=2`);

	await page
		.getByRole("button", {
			name: message("authoring_repositories_create_action"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("authoring_database_block_upload_new_action"),
		})
		.click();
	const uploadDialog = page.getByRole("dialog", {
		name: message("authoring_database_block_upload_dialog_title"),
	});
	await uploadDialog.locator('input[type="file"]').setInputFiles({
		name: "unsaved-notes.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Uploaded by the unsaved changes spec."),
	});
	await uploadDialog
		.getByRole("button", {
			name: message("assets_intake_upload_button"),
		})
		.click();
	await uploadDialog
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	const reviewTitle = uploadDialog.getByText(
		message("assets_intake_review_title"),
	);
	await expect(reviewTitle).toBeVisible();

	const discardDialog = page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_discard_title"),
	});
	await page.keyboard.press("Escape");
	await discardDialog
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();
	await expect(discardDialog).toHaveCount(0);
	await expect(reviewTitle).toBeVisible();

	await page.keyboard.press("Escape");
	await discardDialog
		.getByRole("button", {
			name: message("common_unsaved_changes_discard_button"),
		})
		.click();
	await expect(uploadDialog).toHaveCount(0);
});

test("bots: publishing saves the edits on screen first", async ({
	api,
	org,
	pageAs,
}) => {
	const bot = await memberBot(api, true);
	const renamed = `${bot.name} published`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/bots/${bot.id}/setup?step=0`);

	await nameField(page).fill(renamed);
	await page
		.getByRole("button", {
			name: message("authoring_wizard_step_review_title"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("authoring_wizard_publish_action"),
		})
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", {
			name: message("authoring_publish_confirm_button"),
		})
		.click();

	await expect(page).toHaveURL(new RegExp(`/app/hub/bots/${bot.id}$`));
	await expect(leaveDialog(page)).toHaveCount(0);
	const published = await api.as("member").bot.find({
		id: bot.id,
	});
	expect(published.data).toMatchObject({
		name: renamed,
		status: "ready",
	});
});
