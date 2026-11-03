import {
	enrolTwoFactor,
	passChallenge,
	signInToChallenge,
	totpCode,
} from "../../fixtures/auth/two-factor";
import { createAuthUser } from "../../fixtures/auth/users";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("a user with two-factor authentication signs in with an authenticator code, then with a backup code", async ({
	appBaseURL,
	newContext,
}) => {
	const user = await createAuthUser(appBaseURL, "2fa-challenge");
	const { setupKey, backupCodes } = await enrolTwoFactor(
		appBaseURL,
		user.session,
		user.password,
	);

	const first = await (await newContext()).newPage();
	await signInToChallenge(first, user);
	await passChallenge(first, {
		code: await totpCode(setupKey),
	});
	// A user without an organisation lands on the picker.
	await expect(first).toHaveURL(/\/select-organization/);

	const second = await (await newContext()).newPage();
	await signInToChallenge(second, user);
	await passChallenge(second, {
		code: backupCodes[0],
		backupCode: true,
	});
	await expect(second).toHaveURL(/\/select-organization/);
});

test("a trusted device skips the second step on the next sign-in", async ({
	appBaseURL,
	newContext,
}) => {
	const user = await createAuthUser(appBaseURL, "2fa-trust");
	const { setupKey } = await enrolTwoFactor(
		appBaseURL,
		user.session,
		user.password,
	);

	const context = await newContext();
	const page = await context.newPage();
	await signInToChallenge(page, user);
	await passChallenge(page, {
		code: await totpCode(setupKey),
		trustDevice: true,
	});
	await expect(page).toHaveURL(/\/select-organization/);

	// Signed out on this device, the trust cookie stays.
	await context.clearCookies({
		name: /session_token/,
	});
	const visited: string[] = [];
	page.on("framenavigated", (frame) => {
		if (frame === page.mainFrame()) visited.push(frame.url());
	});
	await open(page, "/login");
	await submitForm(page, {
		fill: async () => {
			await page.getByLabel(message("common_email_label")).fill(user.email);
			await page
				.getByLabel(message("common_password_label"), {
					exact: true,
				})
				.fill(user.password);
		},
		submit: message("auth_signin_form_submit_button"),
		until: /\/select-organization/,
	});
	expect(visited.some((url) => url.includes("/two-factor"))).toBe(false);
});
