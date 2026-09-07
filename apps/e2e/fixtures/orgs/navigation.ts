import { expect, type Page } from "@playwright/test";

/** Open a page behind a capability guard, retrying while snapshot lag makes it redirect. */
export const openWhenGranted = async (
	page: Page,
	path: string,
	heading: string,
): Promise<void> => {
	await expect(async () => {
		await page.goto(path);
		await expect(
			page.getByRole("heading", {
				name: heading,
			}),
		).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 20_000,
	});
};
