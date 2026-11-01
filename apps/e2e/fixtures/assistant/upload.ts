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

/** Pick text files in the widget and upload them; the widget then lists them. */
export const uploadTextFiles = async (
	widget: Locator,
	names: string[],
): Promise<void> => {
	await widget.locator('input[type="file"]').setInputFiles(
		names.map((name) => ({
			name,
			mimeType: "text/plain",
			buffer: Buffer.from("Uploaded by the assistant upload widget spec."),
		})),
	);
	await widget
		.getByRole("button", {
			name: message("assets_intake_upload_button"),
		})
		.click();
};

/** The widget's row of the file `name`, told apart from the file `other`. */
export const uploadRow = (
	widget: Locator,
	name: string,
	other: string,
): Locator =>
	widget
		.locator("div")
		.filter({
			hasText: name,
		})
		.filter({
			hasNotText: other,
		});

/** The widget's Continue, which answers the call with the files it lists. */
export const continueButton = (widget: Locator): Locator =>
	widget.getByRole("button", {
		name: message("assistant_tool_request_upload_continue_button"),
		exact: true,
	});

/** The discard prompt the widget's Cancel shows while an upload is in flight. */
export const discardPrompt = (page: Page): Locator =>
	page.getByRole("alertdialog", {
		name: message("common_unsaved_changes_discard_title"),
	});
