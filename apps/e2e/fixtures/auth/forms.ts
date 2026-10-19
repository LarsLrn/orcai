import { expect, type Locator, type Page } from "@playwright/test";

/** `submitForm` for a form that stays on the page: waits until the feedback shows. */
export const submitFormUntilVisible = async (
	page: Page,
	form: {
		/** Fill every field. */
		fill: () => Promise<void>;
		/** Accessible name of the submit button. */
		submit: string;
		/** What the app shows once it has handled the submission. */
		until: Locator;
	},
): Promise<void> => {
	await form.fill();
	await page
		.getByRole("button", {
			name: form.submit,
		})
		.click();
	await expect(form.until).toBeVisible({
		timeout: 10_000,
	});
};
