import { submitPasswordChange } from "../../fixtures/account/forms";
import {
	accountPath,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { expect, signIn, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { createMember } from "../../fixtures/users";

test("account: a wrong current password is refused, a valid change replaces the password", async ({
	api,
	appBaseURL,
	pageForSession,
}) => {
	const user = await createMember({
		label: "password",
		admin: api.as("admin"),
	});
	const newPassword = `${user.password}-changed`;

	const page = await pageForSession(user.session);

	await openAccountPage(page, "security");

	await submitPasswordChange(
		page,
		{
			current: `${user.password}-wrong`,
			next: newPassword,
		},
		page.getByText(message("error_current_password_incorrect")),
	);

	// The refused attempt left the password alone. Signing in again opens a
	// second session, distinct from the one the change is made on, so the
	// revocation is visible: `pageForSession(user.session)` would carry the
	// same cookie and prove nothing.
	const stillValid = await signIn(appBaseURL, {
		email: user.email,
		password: user.password,
	});

	expect(stillValid.userId).toBe(user.session.userId);

	const earlier = await pageForSession(stillValid);
	await openAccountPage(earlier, "security");

	await submitPasswordChange(
		page,
		{
			current: user.password,
			next: newPassword,
		},
		page.getByText(message("account_change_password_toast_success"), {
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
	await open(earlier, accountPath);
	await expect(earlier).toHaveURL(/\/login/);

	// The session that made the change survives it.
	await openAccountPage(page, "security");
});
