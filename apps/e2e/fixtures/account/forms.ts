import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { submitFormUntilVisible } from "../auth/forms";
import { nameOf } from "./users";

/** Fill the change-password form and confirm the dialog it opens. */
export const submitPasswordChange = async (
	page: Page,
	passwords: {
		current: string;
		next: string;
	},
	/** What the app shows once it has handled the confirmed change. */
	until: Locator,
): Promise<void> => {
	const confirm = page.getByRole("button", {
		name: "Confirm",
	});

	await submitFormUntilVisible(page, {
		fill: async () => {
			await page.getByLabel("Current Password").fill(passwords.current);
			await page
				.getByLabel("New Password", {
					exact: true,
				})
				.fill(passwords.next);
			await page.getByLabel("Confirm New Password").fill(passwords.next);
		},
		submit: "Change Password",
		until: confirm,
	});

	await confirm.click();
	await expect(until).toBeVisible({
		timeout: 15_000,
	});
};

/** Save a new profile name, retrying late hydration until `user.me` reports it. */
export const saveProfileName = async (
	page: Page,
	name: string,
	/** The client of the user whose profile is being saved. */
	api: ApiClient,
): Promise<void> => {
	await expect(async () => {
		await page
			.getByLabel("Name", {
				exact: true,
			})
			.fill(name);
		await page
			.getByRole("button", {
				name: "Save Profile",
			})
			.click();
		await expect
			.poll(() => nameOf(api), {
				timeout: 5_000,
			})
			.toBe(name);
	}).toPass({
		timeout: 25_000,
	});
};
