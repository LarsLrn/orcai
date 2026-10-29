import type { Page } from "@playwright/test";
import {
	type Api,
	expect,
	test,
	type WorkerOrganisation,
} from "../../fixtures/index";
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

/** A member's own template block, open in its edit form. */
const openBlockEditor = async ({
	api,
	org,
	pageAs,
}: {
	api: Api;
	org: WorkerOrganisation;
	pageAs: (role: "member") => Promise<Page>;
}) => {
	const name = `E2E Unsaved ${runId()}`;
	const block = await api.as("member").block.create({
		type: "template",
		name,
		status: "ready",
		config: {
			systemPrompt: "Created by the unsaved changes spec.",
		},
	});
	const detailPath = `/app/library/behaviours/${block.data.id}`;

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `${detailPath}/edit`);

	return {
		page,
		name,
		detailPath,
		nameField: page.getByLabel(message("common_name_label")),
	};
};

test("blocks: stay keeps unsaved edits", async ({ api, org, pageAs }) => {
	const { page, name, detailPath, nameField } = await openBlockEditor({
		api,
		org,
		pageAs,
	});
	await nameField.fill(`${name} edited`);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();

	await expect(leaveDialog(page)).toHaveCount(0);
	await expect(page).toHaveURL(new RegExp(`${detailPath}/edit$`));
	await expect(nameField).toHaveValue(`${name} edited`);
});

test("blocks: leave drops unsaved edits", async ({ api, org, pageAs }) => {
	const { page, name, nameField } = await openBlockEditor({
		api,
		org,
		pageAs,
	});
	await nameField.fill(`${name} edited`);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_leave_button"),
		})
		.click();

	await expect(page).toHaveURL(/\/app\/?$/);
});

test("blocks: saving navigates without asking", async ({
	api,
	org,
	pageAs,
}) => {
	const { page, name, detailPath, nameField } = await openBlockEditor({
		api,
		org,
		pageAs,
	});
	await nameField.fill(`${name} saved`);

	await page
		.getByRole("button", {
			name: message("blocks_template_form_update_submit_button"),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`${detailPath}$`));

	await homeLink(page).click();
	await expect(page).toHaveURL(/\/app\/?$/);
	await expect(leaveDialog(page)).toHaveCount(0);
});
