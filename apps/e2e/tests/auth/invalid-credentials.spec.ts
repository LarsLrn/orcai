import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { submitFormUntilVisible } from "../../fixtures/auth/forms";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

const emailField = (page: Page) =>
	page.getByLabel(message("common_email_label"));

const passwordField = (page: Page) =>
	page.getByLabel(message("common_password_label"), {
		exact: true,
	});

test("the login form rejects a wrong password and stays on the login page", async ({
	org,
	page,
}) => {
	await open(page, "/login");

	await submitFormUntilVisible(page, {
		fill: async () => {
			await emailField(page).fill(org.users.member.email);
			await passwordField(page).fill(`${USER_PASSWORD}-wrong`);
		},
		submit: message("auth_signin_form_submit_button"),
		// The sign-in mutation reports the failure as a toast; the form does
		// not render a message of its own.
		until: page.getByText(message("auth_signin_toast_error")),
	});

	await expect(page).toHaveURL(/\/login/);
});

test("the login form rejects an unknown email address", async ({ page }) => {
	const unknown = `auth-unknown-${randomBytes(3).toString("hex")}@${EMAIL_DOMAIN}`;

	await open(page, "/login");

	await submitFormUntilVisible(page, {
		fill: async () => {
			await emailField(page).fill(unknown);
			await passwordField(page).fill(USER_PASSWORD);
		},
		submit: message("auth_signin_form_submit_button"),
		until: page.getByText(message("auth_signin_toast_error")),
	});

	await expect(page).toHaveURL(/\/login/);
});

test("the login form validates an empty email and a short password", async ({
	page,
}) => {
	await open(page, "/login");

	// The fields validate on change and only show a message once touched, so
	// the spec types and clears instead of submitting an untouched form.
	await expect(async () => {
		await emailField(page).fill("not-an-email");
		await passwordField(page).fill("short");
		await expect(page.getByText("Invalid email address.")).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	await expect(
		page.getByText("Password must be at least 8 characters."),
	).toBeVisible();

	await emailField(page).fill("");
	await passwordField(page).fill("");

	await expect(page.getByText("Invalid email address.")).toBeVisible();
	await expect(
		page.getByText("Password must be at least 8 characters."),
	).toBeVisible();

	await page
		.getByRole("button", {
			name: message("auth_signin_form_submit_button"),
		})
		.click();

	await expect(page).toHaveURL(/\/login/);
});
