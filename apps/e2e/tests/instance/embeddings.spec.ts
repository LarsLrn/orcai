import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { INFERENCE_MOCK_MODELS } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test.describe.configure({
	mode: "serial",
});

const ALTERNATIVE_MODEL = `${INFERENCE_MOCK_MODELS.embedding}-alternative`;

const modelField = (page: Page) =>
	page.getByLabel(message("instance_settings_embeddings_model_label"));

const saveModel = async (page: Page, model: string) => {
	await modelField(page).fill(model);
	await page
		.getByRole("button", {
			name: message("instance_settings_embeddings_save_button"),
		})
		.click();
};

/** The confirmation dialog, which states how many assets it re-embeds. */
const confirmation = (page: Page, title: string) =>
	page.getByRole("alertdialog", {
		name: title,
	});

test("instance: changing the embedding model asks first and states how many assets it re-embeds", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/settings");
	await expect(
		page.getByRole("heading", {
			name: message("instance_settings_index_title"),
		}),
	).toBeVisible();
	// No upload is ever prepared without the workers.
	await expect(
		page.getByText(message("instance_settings_index_empty")),
	).toBeVisible();

	await saveModel(page, ALTERNATIVE_MODEL);
	const dialog = confirmation(
		page,
		message("instance_settings_embeddings_model_change_confirm_title"),
	);
	await expect(dialog).toContainText(
		`OrcAI embeds 0 assets in repositories again with ${ALTERNATIVE_MODEL}.`,
	);
	await dialog
		.getByRole("button", {
			name: message("common_cancel_button"),
		})
		.click();
	await expect(dialog).toBeHidden();
	await page.reload();
	await expect(modelField(page)).toHaveValue(INFERENCE_MOCK_MODELS.embedding);

	await saveModel(page, ALTERNATIVE_MODEL);
	await dialog
		.getByRole("button", {
			name: message("instance_settings_embeddings_model_change_confirm_button"),
		})
		.click();
	await expect(
		page.getByText(message("instance_settings_embeddings_saved_toast")),
	).toBeVisible();
	await page.reload();
	await expect(modelField(page)).toHaveValue(ALTERNATIVE_MODEL);

	// Back to the model the other specs use, confirmed the same way.
	await saveModel(page, INFERENCE_MOCK_MODELS.embedding);
	await dialog
		.getByRole("button", {
			name: message("instance_settings_embeddings_model_change_confirm_button"),
		})
		.click();
	await expect(
		page.getByText(message("instance_settings_embeddings_saved_toast")),
	).toBeVisible();
});

test("instance: Re-embed everything asks first, and Retry failed waits for a failed asset", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/settings");
	await expect(
		page.getByRole("button", {
			name: message("instance_settings_index_retry_button"),
		}),
	).toBeDisabled();

	await page
		.getByRole("button", {
			name: message("instance_settings_index_reembed_button"),
		})
		.click();
	const dialog = confirmation(
		page,
		message("instance_settings_index_reembed_confirm_title"),
	);
	await expect(dialog).toContainText(
		"OrcAI embeds 0 assets in repositories again with the current model",
	);
	await dialog
		.getByRole("button", {
			name: message("instance_settings_index_reembed_confirm_button"),
		})
		.click();
	await expect(
		page.getByText(message("instance_settings_index_reembed_toast_success")),
	).toBeVisible();
	// Nothing waits to be embedded again, so search is complete.
	await expect(
		page.getByText(message("embeddings_rebuild_notice_title")),
	).toBeHidden();
});
