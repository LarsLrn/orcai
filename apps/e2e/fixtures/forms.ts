import { expect, type Locator, type Page } from "@playwright/test";
import { awaitHydration } from "./navigation";

/**
 * Fill and submit a form once the page has hydrated, then wait until the URL
 * matches `until`, or until the `until` feedback shows on a form that stays.
 */
export const submitForm = async (
	page: Page,
	form: {
		/** Fill every field. */
		fill: () => Promise<void>;
		/** Accessible name of the submit button. */
		submit: string;
		until: RegExp | Locator;
	},
): Promise<void> => {
	await awaitHydration(page);
	await form.fill();
	await page
		.getByRole("button", {
			name: form.submit,
		})
		.click();
	if (form.until instanceof RegExp) {
		await expect(page).toHaveURL(form.until, {
			timeout: 10_000,
		});
	} else {
		await expect(form.until).toBeVisible({
			timeout: 10_000,
		});
	}
};
