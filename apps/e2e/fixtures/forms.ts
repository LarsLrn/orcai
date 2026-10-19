import { expect, type Page } from "@playwright/test";

/** Fill and submit a form, then wait until the URL matches `until`. */
export const submitForm = async (
	page: Page,
	form: {
		/** Fill every field. */
		fill: () => Promise<void>;
		/** Accessible name of the submit button. */
		submit: string;
		/** URL pattern that marks the form as accepted. */
		until: RegExp;
	},
): Promise<void> => {
	await form.fill();
	await page
		.getByRole("button", {
			name: form.submit,
		})
		.click();
	await expect(page).toHaveURL(form.until, {
		timeout: 10_000,
	});
};
