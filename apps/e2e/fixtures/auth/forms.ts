import { expect, type Locator, type Page } from "@playwright/test";

/** `submitForm` for a form that stays on the page: retries late hydration until the feedback shows. */
export const submitFormUntilVisible = async (
	page: Page,
	form: {
		/** Fill every field; called again on each retry. */
		fill: () => Promise<void>;
		/** Accessible name of the submit button. */
		submit: string;
		/** What the app shows once it has handled the submission. */
		until: Locator;
	},
): Promise<void> => {
	await expect(async () => {
		await form.fill();
		await page
			.getByRole("button", {
				name: form.submit,
			})
			.click();
		await expect(form.until).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});
};
