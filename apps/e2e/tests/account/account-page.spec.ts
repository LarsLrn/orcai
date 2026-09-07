import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";

test("account: the account page shows the signed-in user's profile and an unverified address", async ({
	org,
	pageAs,
}) => {
	const member = org.users.member;
	const page = await pageAs("member");

	await openAccountPage(page);

	// The name and the address appear both in the stats card and in the
	// sidebar user menu, so one visible occurrence is what is asserted.
	await expect(page.getByText(member.email).first()).toBeVisible();
	await expect(page.getByText("E2E member").first()).toBeVisible();

	await expect(
		accountCard(page, "Your Profile").getByLabel("Name", {
			exact: true,
		}),
	).toHaveValue("E2E member");

	// Sign-up never verifies an address, so a fixture user is unverified and
	// the card offers to send the mail again.
	const verification = accountCard(page, "Email Verification");

	await expect(
		verification.getByText("Your email address is not verified."),
	).toBeVisible();
	await expect(
		verification.getByRole("button", {
			name: "Send Verification Email",
		}),
	).toBeVisible();

	await expect(
		accountCard(page, "Change Password").getByRole("button", {
			name: "Change Password",
		}),
	).toBeVisible();

	await expect(
		page.getByRole("link", {
			name: "Privacy Policy",
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: "Terms of Use",
		}),
	).toBeVisible();
});
