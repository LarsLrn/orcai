import { submitPasswordChange } from "../../fixtures/account/forms";
import {
	accountPath,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, signIn, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";

test("account: a wrong current password is refused, a valid change replaces the password", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "password",
		admin: api.as("admin"),
		organisation: org,
	});
	const newPassword = `${user.password}-changed`;

	const { context, page } = await pageForSession(browser, user.session);
	// A page on a second session of the same user, opened below once the
	// password is known to still work.
	let earlier: Awaited<ReturnType<typeof pageForSession>> | undefined;

	try {
		await openAccountPage(page);

		await submitPasswordChange(
			page,
			{
				current: `${user.password}-wrong`,
				next: newPassword,
			},
			page.getByText("Current password is incorrect"),
		);

		// The refused attempt left the password alone. Signing in again opens a
		// second session, distinct from the one the change is made on, so the
		// revocation is visible: `pageForSession(browser, user.session)` would
		// carry the same cookie and prove nothing.
		const stillValid = await signIn(appBaseURL, {
			email: user.email,
			password: user.password,
		});

		expect(stillValid.userId).toBe(user.session.userId);

		earlier = await pageForSession(browser, stillValid);
		await openAccountPage(earlier.page);

		await submitPasswordChange(
			page,
			{
				current: user.password,
				next: newPassword,
			},
			page.getByText("Password changed", {
				exact: true,
			}),
		);

		await expect(
			signIn(appBaseURL, {
				email: user.email,
				password: user.password,
			}),
		).rejects.toThrow();

		const renewed = await signIn(appBaseURL, {
			email: user.email,
			password: newPassword,
		});

		expect(renewed.userId).toBe(user.session.userId);

		// The change revoked the other session, as a reset does, so the page
		// holding it is handed to the login page.
		await open(earlier.page, accountPath());
		await expect(earlier.page).toHaveURL(/\/en\/login/);

		// The session that made the change survives it.
		await openAccountPage(page);
	} finally {
		await earlier?.context.close();
		await context.close();
	}
});
