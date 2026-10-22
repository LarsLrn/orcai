import { createAccountUser } from "../../fixtures/account/users";
import {
	addPasskey,
	addVirtualAuthenticator,
	assertPasskey,
	dropSession,
} from "../../fixtures/auth/passkey";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("a passkey that does not verify the user does not sign in", async ({
	api,
	appBaseURL,
	browser,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "passkey-uv",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
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
		expect(unverified.status()).toBe(401);
		expect(await unverified.json()).toMatchObject({
			code: "PASSKEY_USER_NOT_VERIFIED",
		});

		const verified = await assertPasskey(page, credential, {
			userVerified: true,
		});
		expect(verified.status()).toBe(200);
	} finally {
		await context.close();
	}
});
