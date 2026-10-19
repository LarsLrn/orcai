import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { submitFormUntilVisible } from "../auth/forms";
import { message } from "../messages";
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
		name: message("common_confirm_button"),
	});

	await submitFormUntilVisible(page, {
		fill: async () => {
			await page
				.getByLabel(message("auth_change_password_form_current_password_label"))
				.fill(passwords.current);
			await page
				.getByLabel(message("auth_change_password_form_new_password_label"), {
					exact: true,
				})
				.fill(passwords.next);
			await page
				.getByLabel(message("auth_change_password_form_confirm_password_label"))
				.fill(passwords.next);
		},
		submit: message("auth_change_password_form_submit_button"),
		until: confirm,
	});

	await confirm.click();
	await expect(until).toBeVisible({
		timeout: 15_000,
	});
};

/** Save a new profile name and wait until `user.me` reports it. */
export const saveProfileName = async (
	page: Page,
	name: string,
	/** The client of the user whose profile is being saved. */
	api: ApiClient,
): Promise<void> => {
	await page
		.getByLabel(message("users_profile_form_name_label"), {
			exact: true,
		})
		.fill(name);
	await page
		.getByRole("button", {
			name: message("users_profile_form_submit_button"),
		})
		.click();
	await expect
		.poll(() => nameOf(api), {
			timeout: 10_000,
		})
		.toBe(name);
};
