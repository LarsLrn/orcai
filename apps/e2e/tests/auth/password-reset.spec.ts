import { signIn } from "../../fixtures/auth";
import { submitFormUntilVisible } from "../../fixtures/auth/forms";
import { waitForLink } from "../../fixtures/auth/outbox";
import { createAuthUser, pageForSession } from "../../fixtures/auth/users";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
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
		await open(earlier.page, "/en/select-organization");
		await expect(earlier.page).toHaveURL(/\/en\/select-organization/);

		await open(page, "/en/forgot-password");

		await submitFormUntilVisible(page, {
			fill: async () => {
				await page.getByLabel("Email").fill(user.email);
			},
			submit: "Send reset email",
			// The page never navigates; the answer is a toast, worded so that
			// it does not reveal whether the address exists.
			until: page.getByText(
				"If an account exists for that address, a password reset email has been sent.",
			),
		});

		const link = await waitForLink(outbox, user.email, "auth.reset-password");

		// The queued link goes through Better Auth, which redirects to the
		// reset page with the token in the query string.
		await open(page, link);
		await expect(page).toHaveURL(/\/reset-password\?.*token=/);
		await expect(page.getByText("Choose a new password")).toBeVisible();

		await submitForm(page, {
			fill: async () => {
				await page.getByLabel("New Password").fill(newPassword);
				await page.getByLabel("Confirm Password").fill(newPassword);
			},
			submit: "Reset password",
			until: /\/en\/login/,
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
				await page.getByLabel("Email").fill(user.email);
				await page
					.getByLabel("Password", {
						exact: true,
					})
					.fill(newPassword);
			},
			submit: "Login",
			until: /^(?!.*\/en\/login).*$/,
		});

		// The user belongs to no organisation, so the app hands it to the
		// selection page.
		await expect(page).toHaveURL(/\/en\/select-organization/);

		await open(earlier.page, "/en/select-organization");
		await expect(earlier.page).toHaveURL(/\/en\/login/);
	} finally {
		await earlier.context.close();
	}
});
