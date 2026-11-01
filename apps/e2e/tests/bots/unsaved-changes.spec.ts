import type { Locator, Page } from "@playwright/test";
import { holdUploads } from "../../fixtures/assets";
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
	await open(page, "/app/library/bots/add");
	await nameField(page).fill(name);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();

	await expect(leaveDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/app\/library\/bots\/add/);
	await expect(nameField(page)).toHaveValue(name);
});

test("bots: saving and changing steps never ask, leaving with edits does", async ({
	org,
	pageAs,
}) => {
	const name = `E2E Unsaved Bot ${runId()}`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/library/bots/add");
	await nameField(page).fill(name);
	await page
		.getByLabel(message("authoring_basics_description_label"))
		.fill("Created by the unsaved changes spec.");

	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/library\/bots\/[^/]+\/setup\?step=1/);
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

const memberBot = async (api: Api, withBehaviour = false) => {
	const member = api.as("member");
	const behaviour = withBehaviour
		? await member.block.create({
				type: "behaviour",
				name: `E2E Unsaved Behaviour ${runId()}`,
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
		behaviourId: behaviour?.data.id ?? null,
		repositoryIds: [],
	});

	return bot.data;
};

const openUploadDialog = async (page: Page) => {
	await page
		.getByRole("button", {
			name: message("authoring_repositories_create_action"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("authoring_repository_upload_new_action"),
		})
		.click();
	return page.getByRole("dialog", {
		name: message("authoring_repository_upload_dialog_title"),
	});
};

const uploadNotes = async (dialog: Locator, name: string) => {
	await dialog.locator('input[type="file"]').setInputFiles({
		name,
		mimeType: "text/plain",
		buffer: Buffer.from("Uploaded by the unsaved changes spec."),
	});
	await dialog
		.getByRole("button", {
			name: message("assets_intake_upload_button"),
		})
		.click();
};

test("bots: closing the upload dialog asks only while an upload is in flight", async ({
	api,
	org,
	pageAs,
}) => {
	const bot = await memberBot(api);
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}/setup?step=2`);
	const uploadDialog = await openUploadDialog(page);
	const uploads = await holdUploads(page);
	await uploadNotes(uploadDialog, "unsaved-notes.txt");

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
	await expect(uploadDialog).toBeVisible();

	await page.keyboard.press("Escape");
	await discardDialog
		.getByRole("button", {
			name: message("common_unsaved_changes_discard_button"),
		})
		.click();
	await expect(uploadDialog).toHaveCount(0);
	uploads.release();

	await page
		.getByRole("button", {
			name: message("authoring_repository_upload_new_action"),
		})
		.click();
	await uploadNotes(uploadDialog, "kept-notes.txt");
	await expect(
		uploadDialog.getByText(message("assets_intake_review_title")),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(discardDialog).toHaveCount(0);
	await expect(uploadDialog).toHaveCount(0);
});

test("bots: assets uploaded in the repository dialog are selected at once", async ({
	api,
	org,
	pageAs,
}) => {
	const bot = await memberBot(api);
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}/setup?step=2`);
	const uploadDialog = await openUploadDialog(page);
	const name = `E2E Selected ${runId()}.txt`;

	await uploadNotes(uploadDialog, name);
	const done = uploadDialog.getByRole("button", {
		name: message("assets_intake_done_button"),
	});
	await expect(done).toBeVisible();
	await expect(
		uploadDialog.getByText(name, {
			exact: true,
		}),
	).toBeVisible();
	await done.click();

	await expect(uploadDialog).toHaveCount(0);
	await expect(
		page.getByText(name, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(
			message("authoring_repository_attached_badge", {
				count: 1,
			}),
		),
	).toBeVisible();
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
	await open(page, `/app/library/bots/${bot.id}/setup?step=0`);

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

	await expect(page).toHaveURL(new RegExp(`/app/library/bots/${bot.id}$`));
	await expect(leaveDialog(page)).toHaveCount(0);
	const published = await api.as("member").bot.find({
		id: bot.id,
	});
	expect(published.data).toMatchObject({
		name: renamed,
		status: "ready",
	});
});
