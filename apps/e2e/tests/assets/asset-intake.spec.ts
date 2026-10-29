import type { Page } from "@playwright/test";
import { holdUploads } from "../../fixtures/assets";
import { adoptPageZedToken } from "../../fixtures/authz/resources";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const uploadOnAddPage = async (page: Page, name: string) => {
	await page.locator('input[type="file"]').setInputFiles({
		name,
		mimeType: "text/plain",
		buffer: Buffer.from("Uploaded by the asset intake spec."),
	});
	await page
		.getByRole("button", {
			name: message("assets_intake_upload_button"),
		})
		.click();
};

const leaveDialog = (page: Page) =>
	page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_title"),
	});

const homeLink = (page: Page) =>
	page.getByRole("link", {
		name: message("sidebar_logo_home_link_label"),
	});

test("assets: an upload is an asset without another click", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const name = `E2E Intake ${runId()}.txt`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/library/assets/add");

	await uploadOnAddPage(page, name);
	await expect(
		page.getByText(message("assets_intake_review_title")),
	).toBeVisible();
	await expect(
		page.getByText(name, {
			exact: true,
		}),
	).toBeVisible();

	await homeLink(page).click();
	await expect(page).not.toHaveURL(/\/app\/library\/assets\/add/);
	await expect(leaveDialog(page)).toHaveCount(0);

	await adoptPageZedToken(page, zedTokens);
	const { data } = await api.as("member").asset.list({
		filters: {
			search: name,
		},
	});
	expect(data).toMatchObject([
		{
			title: name,
			origin: "library",
		},
	]);
});

test("assets: leaving asks only while an upload is in flight", async ({
	api,
	org,
	pageAs,
}) => {
	const name = `E2E Intake Abandoned ${runId()}.txt`;
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/library/assets/add");
	const uploads = await holdUploads(page);

	await uploadOnAddPage(page, name);
	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/library\/assets\/add/);

	await homeLink(page).click();
	await leaveDialog(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_leave_button"),
		})
		.click();
	await expect(page).not.toHaveURL(/\/app\/library\/assets\/add/);
	uploads.release();

	const { data } = await api.as("member").asset.list({
		filters: {
			search: name,
		},
	});
	expect(data).toEqual([]);
});
