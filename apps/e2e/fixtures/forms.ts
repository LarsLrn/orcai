import { expect, type Page } from "@playwright/test";

/**
 * Fill and submit a form, retrying late hydration until the URL matches
 * `until`. An attempt that finds the page already there returns at once.
 */
export const submitForm = async (
	page: Page,
	form: {
		/** Fill every field; called again on each retry. */
		fill: () => Promise<void>;
		/** Accessible name of the submit button. */
		submit: string;
		/** URL pattern that marks the form as accepted. */
		until: RegExp;
	},
): Promise<void> => {
	await expect(async () => {
		if (form.until.test(page.url())) {
			return;
		}

		await form.fill();
		await page
			.getByRole("button", {
				name: form.submit,
			})
			.click();
		await expect(page).toHaveURL(form.until, {
			timeout: 10_000,
		});
	}).toPass({
		timeout: 25_000,
	});
};
