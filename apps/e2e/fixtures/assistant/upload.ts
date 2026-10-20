import type { AssetId } from "@orcai/core";
import { expect, type Locator, type Page } from "@playwright/test";
import type { ScriptedToolCall } from "../inference/fixture";
import { message } from "../messages";

export const requestUploadCall = (reason: string): ScriptedToolCall => ({
	name: "requestUpload",
	input: {
		reason,
	},
});

/** The upload widget of the paused reply, by its title. */
export const uploadWidget = (page: Page): Locator =>
	page.getByRole("log").getByRole("group", {
		name: message("assistant_tool_request_upload_name"),
		exact: true,
	});

/** Pick a text file in the widget and upload it, leaving it uploaded but unsaved. */
export const uploadTextFile = async (
	widget: Locator,
	name: string,
): Promise<void> => {
	await widget.locator('input[type="file"]').setInputFiles({
		name,
		mimeType: "text/plain",
		buffer: Buffer.from("Uploaded by the assistant upload widget spec."),
	});
	await widget
		.getByRole("button", {
			name: message("assets_intake_upload_button"),
		})
		.click();
	await expect(
		widget.getByRole("button", {
			name: message("common_next_button"),
		}),
	).toBeEnabled();
};

/** Review the uploaded files and save them as assets. */
export const saveUploadedFiles = async (widget: Locator): Promise<void> => {
	await widget
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	await expect(
		widget.getByText(message("assets_intake_review_title")),
	).toBeVisible();
	await widget
		.getByRole("button", {
			name: message("assets_intake_submit_button"),
		})
		.click();
};

/** The discard prompt the widget's Cancel shows with unsaved uploads. */
export const discardPrompt = (page: Page): Locator =>
	page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_discard_title"),
	});

/**
 * The suite runs no workers, so a fresh upload's processing job has no queue
 * and `asset.saveMany` fails. Saves the widget's reviewed file onto an asset
 * row created over the API instead; the rest runs as in the app.
 */
export const saveOntoAsset = async (
	page: Page,
	assetId: AssetId,
): Promise<void> => {
	await page.route("**/api/rpc/asset/saveMany", async (route) => {
		const body = route.request().postDataJSON() as {
			json: {
				assets: Record<string, unknown>[];
			};
		};

		await route.continue({
			postData: JSON.stringify({
				...body,
				json: {
					assets: body.json.assets.map(({ upload: _, ...asset }) => ({
						...asset,
						id: assetId,
					})),
				},
			}),
		});
	});
};
