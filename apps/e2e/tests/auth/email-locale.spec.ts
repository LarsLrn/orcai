import { storeLocale } from "../../fixtures/account/locale";
import { submitFormUntilVisible } from "../../fixtures/auth/forms";
import { waitForLink } from "../../fixtures/auth/outbox";
import { createAuthUser } from "../../fixtures/auth/users";
import { USER_PASSWORD } from "../../fixtures/constants";
import { expectEmailIn, queuedEmail } from "../../fixtures/emails/render";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import {
	INVITED_NOTIFICATION,
	invitationEmail,
	inviteEmail,
	registerFromInvitation,
} from "../../fixtures/orgs/invitations";

const VERIFY_NOTIFICATION = "auth.verify-email";
const RESET_NOTIFICATION = "auth.reset-password";

const VERIFY_COPY = {
	subject: "email_verify_subject",
	text: "email_verify_body",
};

test("auth: registering from a German browser queues a German verification email", async ({
	api,
	browser,
	outbox,
}) => {
	const email = invitationEmail("verify-de");
	await inviteEmail(api.as("admin"), {
		email,
		role: "viewer",
	});
	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);

	// No cookie: the browser's Accept-Language alone picks German.
	const context = await browser.newContext({
		locale: "de-DE",
	});

	try {
		const page = await context.newPage();

		await open(page, link);
		await expect(page.locator("html")).toHaveAttribute("lang", "de");

		await submitForm(page, {
			fill: async () => {
				await page
					.getByLabel(message("auth_signup_form_name_label", {}, "de"), {
						exact: true,
					})
					.fill("E2E Auth Deutsch");
				await page
					.getByLabel(message("auth_signup_form_password_label", {}, "de"), {
						exact: true,
					})
					.fill(USER_PASSWORD);
				await page
					.getByLabel(
						message("auth_signup_form_confirm_password_label", {}, "de"),
					)
					.fill(USER_PASSWORD);

				const consent = page.getByRole("switch", {
					name: message("auth_signup_form_privacy_consent_label", {}, "de"),
				});
				await consent.check();
				await expect(consent).toBeChecked();
			},
			submit: message("auth_signup_form_submit_button", {}, "de"),
			until: /\/app(\/|$)/,
		});
		await expect(
			page.getByText(message("home_try_title", {}, "de")),
		).toBeVisible();
	} finally {
		await context.close();
	}

	await expectEmailIn(
		await queuedEmail(outbox, email, VERIFY_NOTIFICATION),
		"de",
		VERIFY_COPY,
	);
});

test("auth: registering from an English browser queues an English verification email", async ({
	api,
	outbox,
	page,
}) => {
	const email = invitationEmail("verify-en");
	await inviteEmail(api.as("admin"), {
		email,
		role: "viewer",
	});
	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);

	await registerFromInvitation(page, link, {
		name: "E2E Auth English",
		password: USER_PASSWORD,
	});
	await expect(page.getByText(message("home_try_title"))).toBeVisible();

	await expectEmailIn(
		await queuedEmail(outbox, email, VERIFY_NOTIFICATION),
		"en",
		VERIFY_COPY,
	);
});

test("auth: a password reset email follows the stored language, not the browser's", async ({
	appBaseURL,
	outbox,
	page,
}) => {
	const user = await createAuthUser(appBaseURL, "reset-locale");
	await storeLocale(appBaseURL, user.session, "de");

	await open(page, "/forgot-password");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");

	await submitFormUntilVisible(page, {
		fill: async () => {
			await page.getByLabel(message("common_email_label")).fill(user.email);
		},
		submit: message("auth_forgot_password_form_submit_button"),
		until: page.getByText(message("auth_forgot_password_toast_success")),
	});

	await expectEmailIn(
		await queuedEmail(outbox, user.email, RESET_NOTIFICATION),
		"de",
		{
			subject: "email_reset_password_subject",
			text: "email_reset_password_body",
		},
	);
});
