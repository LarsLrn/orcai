import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ZED_TOKEN_COOKIE, type ZedTokenStore } from "../api";
import { message } from "../messages";
import { open } from "../navigation";

/** A behaviour, the one grantable resource that needs no model, provider, or worker. */
export const behaviourInput = (name: string) => ({
	type: "behaviour" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the members slice.",
	},
});

/** Carry the newest revision a page has been given back to the test's API clients. */
export const adoptZedToken = async (
	page: Page,
	zedTokens: ZedTokenStore,
): Promise<void> => {
	const cookie = (await page.context().cookies()).find(
		(entry) => entry.name === ZED_TOKEN_COOKIE,
	);

	if (cookie) await zedTokens.observe(cookie.value);
};

/** Open a page behind the `manage_members` guard. */
export const reachPage = async (
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

/** The row of the members table that belongs to an email address. */
export const memberRow = (page: Page, email: string): Locator =>
	page.getByRole("row").filter({
		hasText: email,
	});

/** The entries of the row action menu for a user. */
export const rowMenuItems = async (
	page: Page,
	email: string,
): Promise<string[]> => {
	await memberRow(page, email)
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();

	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();

	return await menu.getByRole("menuitem").allInnerTexts();
};

/** Pick a role in the edit page's role picker, whose trigger is named after the current role. */
export const chooseRole = async (
	page: Page,
	from: string,
	to: string,
): Promise<void> => {
	await page
		.getByRole("button", {
			name: from,
			exact: true,
		})
		.click();
	await page
		.getByRole("option", {
			name: new RegExp(`^${to}`),
		})
		.click();
};
