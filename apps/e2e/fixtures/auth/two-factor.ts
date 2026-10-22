import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page } from "@playwright/test";
import type { Session } from "../auth";
import { submitForm } from "../forms";
import { message } from "../messages";
import { open } from "../navigation";

/** The code an authenticator app shows for a setup key right now. */
export const totpCode = (setupKey: string): Promise<string> =>
	createOTP(new TextDecoder().decode(base32.decode(setupKey))).totp();

const postAuth = async (
	baseURL: string,
	path: string,
	cookieHeader: string,
	payload: unknown,
) => {
	const response = await fetch(`${baseURL}/api/auth${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: cookieHeader,
			// Better Auth rejects requests without a trusted origin.
			origin: baseURL,
		},
		body: JSON.stringify(payload),
	});
	if (!response.ok)
		throw new Error(
			`POST ${path} failed with ${String(response.status)}: ${await response.text()}`,
		);
	return response;
};

/**
 * Turns two-factor authentication on through the API. Better Auth replaces the
 * session it ran on, so `session` no longer signs in afterwards.
 */
export const enrolTwoFactor = async (
	baseURL: string,
	session: Session,
	password: string,
): Promise<{
	setupKey: string;
	backupCodes: string[];
}> => {
	const enabled = (await (
		await postAuth(baseURL, "/two-factor/enable", session.cookieHeader, {
			password,
		})
	).json()) as {
		totpURI: string;
		backupCodes: string[];
	};
	const setupKey = new URL(enabled.totpURI).searchParams.get("secret");
	if (!setupKey) throw new Error("The TOTP URI carries no secret.");

	await postAuth(baseURL, "/two-factor/verify-totp", session.cookieHeader, {
		code: await totpCode(setupKey),
	});

	return {
		setupKey,
		backupCodes: enabled.backupCodes,
	};
};

/** Signs in through the login form up to the second step. */
export const signInToChallenge = async (
	page: Page,
	user: {
		email: string;
		password: string;
	},
): Promise<void> => {
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
		until: /\/two-factor$/,
	});
	await expect(
		page.getByText(message("two_factor_challenge_page_description")),
	).toBeVisible();
};

/** Submits the second step and waits until the browser leaves it. */
export const passChallenge = async (
	page: Page,
	answer: {
		code: string;
		backupCode?: boolean;
		trustDevice?: boolean;
	},
): Promise<void> => {
	await submitForm(page, {
		fill: async () => {
			if (answer.backupCode)
				await page
					.getByRole("button", {
						name: message("two_factor_use_backup_code_button"),
					})
					.click();
			await page
				.getByLabel(
					message(
						answer.backupCode
							? "two_factor_backup_code_label"
							: "two_factor_code_label",
					),
				)
				.fill(answer.code);
			if (answer.trustDevice)
				await page
					.getByRole("checkbox", {
						name: message("two_factor_trust_device_label"),
					})
					.check();
		},
		submit: message("two_factor_challenge_submit_button"),
		until: /^(?!.*\/two-factor).*$/,
	});
};
