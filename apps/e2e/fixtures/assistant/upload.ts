import type { Locator, Page } from "@playwright/test";
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

/** Pick a text file in the widget and upload it; created assets answer the call. */
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
};

/** The discard prompt the widget's Cancel shows while an upload is in flight. */
export const discardPrompt = (page: Page): Locator =>
	page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_discard_title"),
	});
