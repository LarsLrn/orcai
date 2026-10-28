import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const generateButton = (page: Page) =>
	page.getByRole("button", {
		name: message("assets_metadata_generate_button"),
	});

test("assets: without a utility model metadata is not generated", async ({
	api,
	org,
	pageAs,
}) => {
	const asset = await uploadAsset(api.as("member"), `E2E Metadata ${runId()}`);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/assets/${asset.id}/edit`);
	await expect(generateButton(page)).toBeDisabled();
	await expect(
		page.getByText(message("assets_metadata_no_utility_model_hint")),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("assets_metadata_organisation_settings_link"),
		}),
	).toHaveCount(0);

	await open(page, "/app/hub/assets");
	await expect(
		page.locator('[data-slot="card"]').filter({
			hasText: asset.title,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("assets_metadata_backfill_action"),
		}),
	).toHaveCount(0);
});

test("assets: without a utility model admins are pointed to the organisation settings", async ({
	api,
	org,
	pageAs,
}) => {
	const asset = await uploadAsset(api.as("admin"), `E2E Metadata ${runId()}`);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/assets/${asset.id}/edit`);
	await expect(generateButton(page)).toBeDisabled();
	await expect(
		page.getByRole("link", {
			name: message("assets_metadata_organisation_settings_link"),
		}),
	).toHaveAttribute("href", /\/app\/organization$/);
});
