import { openAccountPage } from "../../fixtures/account/navigation";
import {
	addPasskey,
	addVirtualAuthenticator,
	assertPasskey,
	currentSession,
	dropSession,
	forgeUnverifiedRegistrations,
	storedPasskeys,
} from "../../fixtures/auth/passkey";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { createMember } from "../../fixtures/users";

test("a passkey that does not verify the user is not registered", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "passkey-uv-register",
		admin: api.as("admin"),
	});
	const page = await pageForSession(user.session);
	await addVirtualAuthenticator(page);

	const stopForging = await forgeUnverifiedRegistrations(page);
	await openAccountPage(page, "security");
	const [refused] = await Promise.all([
		page.waitForResponse("**/api/auth/passkey/verify-registration"),
		page
			.getByRole("button", {
				name: message("passkey_add_button"),
			})
			.click(),
	]);
	expect(refused.ok()).toBe(false);
	await expect(
		page.getByText(message("passkey_add_toast_error"), {
			exact: true,
		}),
	).toBeVisible();
	expect(await storedPasskeys(page)).toEqual([]);

	await stopForging();
	await addPasskey(page);
	expect(await storedPasskeys(page)).toHaveLength(1);
});

test("a passkey that does not verify the user does not sign in", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "passkey-uv",
		admin: api.as("admin"),
	});
	const page = await pageForSession(user.session);

	const authenticator = await addVirtualAuthenticator(page);
	await addPasskey(page);
	const [credential] = await authenticator.credentials();
	await dropSession(page);
	await open(page, "/login");

	// A key that only proves presence: Chromium refuses it a sign-in itself.
	await authenticator.dropUserVerification();
	await page
		.getByRole("button", {
			name: message("auth_signin_passkey_button"),
		})
		.click();
	await expect(
		page.getByText(message("auth_signin_toast_error"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(page).toHaveURL(/\/login/);

	// Better Auth refuses the same assertion when a client sends it anyway.
	const unverified = await assertPasskey(page, credential, {
		userVerified: false,
	});
	expect(unverified.ok()).toBe(false);
	expect(await currentSession(page)).toBeNull();

	const verified = await assertPasskey(page, credential, {
		userVerified: true,
	});
	expect(verified.ok()).toBe(true);
	expect((await currentSession(page))?.user.email).toBe(user.email);
});
