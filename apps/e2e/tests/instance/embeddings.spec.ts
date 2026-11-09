import { INFERENCE_MOCK_MODELS } from "@orcai/ai/testing";
import type { AssetId, BlockId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { failWithMissingExtraction } from "../../fixtures/instance/missing-extraction";
import { message } from "../../fixtures/messages";
import { awaitHydration, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

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

/** A confirmed model or passage prefix change creates a Qdrant collection and its indexes before it answers. */
const NEW_COLLECTION_SAVE = {
	timeout: 15_000,
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
	await awaitHydration(page);
	await expect(modelField(page)).toHaveValue(INFERENCE_MOCK_MODELS.embedding);

	await saveModel(page, ALTERNATIVE_MODEL);
	await dialog
		.getByRole("button", {
			name: message("instance_settings_embeddings_model_change_confirm_button"),
		})
		.click();
	await expect(
		page.getByText(message("instance_settings_embeddings_saved_toast")),
	).toBeVisible(NEW_COLLECTION_SAVE);
	await page.reload();
	await awaitHydration(page);
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
	).toBeVisible(NEW_COLLECTION_SAVE);
});

test("instance: another query prefix saves at once, another passage prefix asks first", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/settings");
	const queryPrefix = page.getByLabel(
		message("instance_settings_embeddings_query_prefix_label"),
	);
	const passagePrefix = page.getByLabel(
		message("instance_settings_embeddings_passage_prefix_label"),
	);
	await expect(
		page.getByText(
			message("instance_settings_embeddings_query_prefix_description"),
		),
	).toBeVisible();
	await expect(
		page.getByText(
			message("instance_settings_embeddings_passage_prefix_description"),
		),
	).toBeVisible();
	const save = page.getByRole("button", {
		name: message("instance_settings_embeddings_save_button"),
	});
	const saved = page.getByText(
		message("instance_settings_embeddings_saved_toast"),
	);
	const dialog = confirmation(
		page,
		message("instance_settings_embeddings_passage_prefix_confirm_title"),
	);
	const confirm = dialog.getByRole("button", {
		name: message("instance_settings_embeddings_passage_prefix_confirm_button"),
	});

	const instruction =
		"Instruct: Given a question, retrieve passages that answer it\nQuery: ";
	await queryPrefix.fill(instruction);
	await save.click();
	await expect(saved).toBeVisible();
	await expect(dialog).toBeHidden();
	await page.reload();
	await awaitHydration(page);
	await expect(queryPrefix).toHaveValue(instruction);

	await passagePrefix.fill("passage: ");
	await expect(
		page.getByText(
			message("instance_settings_embeddings_passage_prefix_changed_title"),
		),
	).toBeVisible();
	await save.click();
	await expect(dialog).toContainText(
		"OrcAI embeds 0 assets in repositories again with the new passage prefix.",
	);
	await confirm.click();
	await expect(saved).toBeVisible(NEW_COLLECTION_SAVE);
	await page.reload();
	await awaitHydration(page);
	await expect(passagePrefix).toHaveValue("passage: ");

	// Back to no prefixes for the other specs.
	await queryPrefix.fill("");
	await passagePrefix.fill("");
	await save.click();
	await confirm.click();
	await expect(saved).toBeVisible(NEW_COLLECTION_SAVE);
	await page.reload();
	await awaitHydration(page);
	await expect(queryPrefix).toHaveValue("");
	await expect(passagePrefix).toHaveValue("");
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

test("instance: Prepare assets again shows for an asset missing its stored text and asks first with the count", async ({
	api,
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/settings");
	const prepareAgain = page.getByRole("button", {
		name: message("instance_settings_index_prepare_again_button"),
	});
	await expect(
		page.getByRole("heading", {
			name: message("instance_settings_index_title"),
		}),
	).toBeVisible();
	await expect(prepareAgain).toBeHidden();

	const client = api.as("admin");
	const name = `Missing extraction ${runId()}`;
	const asset = await uploadAsset(client, `${name}.txt`);
	const block = await client.block.create({
		type: "repository",
		name,
		status: "ready",
		assets: [
			asset.id,
		],
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	const restore = await failWithMissingExtraction({
		assetId: asset.id as AssetId,
		blockId: block.data.id as BlockId,
	});
	try {
		await page.reload();
		await awaitHydration(page);
		await expect(
			page.getByText(
				message("instance_settings_index_prepare_again_description"),
			),
		).toBeVisible();
		await prepareAgain.click();
		const dialog = confirmation(page, "Prepare 1 asset again?");
		await expect(dialog).toContainText(
			message("instance_settings_index_prepare_again_confirm_description"),
		);
		await dialog
			.getByRole("button", {
				name: message("common_cancel_button"),
			})
			.click();
		await expect(dialog).toBeHidden();
	} finally {
		// The other specs count no prepared asset.
		await restore();
	}
});
