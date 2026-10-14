import { signIn } from "../../fixtures/auth";
import { submitFormUntilVisible } from "../../fixtures/auth/forms";
import { waitForLink } from "../../fixtures/auth/outbox";
import { createAuthUser, pageForSession } from "../../fixtures/auth/users";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("a user resets the password from the emailed link, which revokes the old session", async ({
	appBaseURL,
	browser,
	outbox,
	page,
}) => {
	const user = await createAuthUser(appBaseURL, "reset");
	const newPassword = `${user.password}-reset`;

	// A page holding the session the user had before the reset. Better Auth is
	// configured with `revokeSessionsOnPasswordReset`, so it has to die.
	const earlier = await pageForSession(browser, user.session);

	try {
		await open(earlier.page, "/select-organization");
		await expect(earlier.page).toHaveURL(/\/select-organization/);

		await open(page, "/forgot-password");

		await submitFormUntilVisible(page, {
			fill: async () => {
				await page.getByLabel(message("common_email_label")).fill(user.email);
			},
			submit: message("auth_forgot_password_form_submit_button"),
			// The page never navigates; the answer is a toast, worded so that
			// it does not reveal whether the address exists.
			until: page.getByText(message("auth_forgot_password_toast_success")),
		});

		const link = await waitForLink(outbox, user.email, "auth.reset-password");

		// The queued link goes through Better Auth, which redirects to the
		// reset page with the token in the query string.
		await open(page, link);
		await expect(page).toHaveURL(/\/reset-password\?.*token=/);
		await expect(
			page.getByText(message("auth_reset_password_page_title")),
		).toBeVisible();

		await submitForm(page, {
			fill: async () => {
				await page
					.getByLabel(message("auth_reset_password_form_new_password_label"))
					.fill(newPassword);
				await page
					.getByLabel(
						message("auth_reset_password_form_confirm_password_label"),
					)
					.fill(newPassword);
			},
			submit: message("auth_reset_password_form_submit_button"),
			until: /\/login/,
		});

		// The password that was replaced no longer opens a session.
		await expect(
			signIn(appBaseURL, {
				email: user.email,
				password: user.password,
			}),
		).rejects.toThrow();

		await submitForm(page, {
			fill: async () => {
				await page.getByLabel(message("common_email_label")).fill(user.email);
				await page
					.getByLabel(message("common_password_label"), {
						exact: true,
					})
					.fill(newPassword);
			},
			submit: message("auth_signin_form_submit_button"),
			until: /^(?!.*\/login).*$/,
		});

		// The user belongs to no organisation, so the app hands it to the
		// selection page.
		await expect(page).toHaveURL(/\/select-organization/);

		await open(earlier.page, "/select-organization");
		await expect(earlier.page).toHaveURL(/\/login/);
	} finally {
		await earlier.context.close();
	}
});
