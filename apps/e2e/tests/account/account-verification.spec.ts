import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import {
	latestVerificationId,
	waitForNewVerificationLink,
} from "../../fixtures/account/outbox";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";

test("account: a user sends the verification email and the link verifies the address", async ({
	api,
	appBaseURL,
	browser,
	org,
	outbox,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "verify",
		admin: api.as("admin"),
		organisation: org,
	});

	// Signing up already queued one verification mail, so the resend is only
	// recognisable as a row newer than that one.
	const fromSignUp = await latestVerificationId(outbox, user.email);
	// Better Auth tokens have second precision. A resend in the sign-up
	// second produces the same token and is correctly deduplicated.
	const signUpSecond = Math.floor(Date.now() / 1_000);
	await expect
		.poll(() => Math.floor(Date.now() / 1_000))
		.toBeGreaterThan(signUpSecond);
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);

		const verification = accountCard(page, "Email Verification");

		await expect(
			verification.getByText("Your email address is not verified."),
		).toBeVisible();

		// Late hydration: the click is retried until the toast shows.
		await expect(async () => {
			await verification
				.getByRole("button", {
					name: "Send Verification Email",
				})
				.click();
			await expect(
				page.getByText(
					"If an account exists for that address, a verification email has been sent.",
				),
			).toBeVisible({
				timeout: 5_000,
			});
		}).toPass({
			timeout: 25_000,
		});

		const link = await waitForNewVerificationLink(
			outbox,
			user.email,
			fromSignUp,
		);

		// Better Auth verifies the address, signs the user in again
		// (`autoSignInAfterVerification`) and hands the browser to the
		// callback the account page asked for.
		await open(page, link);
		await expect(page).toHaveURL(/\/en\/(select-organization|app)/);

		await openAccountPage(page);

		await expect(
			accountCard(page, "Email Verification").getByText(
				"Your email address is verified.",
			),
		).toBeVisible();
		await expect(
			accountCard(page, "Email Verification").getByRole("button", {
				name: "Send Verification Email",
			}),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});
