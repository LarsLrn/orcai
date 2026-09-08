import { expect, type Page } from "@playwright/test";
import { open } from "../navigation";

/** Open a page behind a capability guard and assert the heading it renders. */
export const openGuarded = async (
	page: Page,
	path: string,
	heading: string,
): Promise<void> => {
	await open(page, path);
	await expect(
		page.getByRole("heading", {
			name: heading,
		}),
	).toBeVisible();
};
