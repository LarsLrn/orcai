import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";

test("account: the account page shows the signed-in user's profile and an unverified address, and its tabs navigate", async ({
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
		accountCard(page, message("account_profile_card_title")).getByLabel(
			message("users_profile_form_name_label"),
			{
				exact: true,
			},
		),
	).toHaveValue("E2E member");

	// Sign-up never verifies an address, so a fixture user is unverified and
	// the card offers to send the mail again.
	const verification = accountCard(
		page,
		message("account_verification_card_title"),
	);

	await expect(
		verification.getByText(
			message("account_verification_unverified_description"),
		),
	).toBeVisible();
	await expect(
		verification.getByRole("button", {
			name: message("account_verification_send_button"),
		}),
	).toBeVisible();

	// Each tab is its own route, so the tab list navigates.
	const tab = (name: string) =>
		page.getByRole("tab", {
			name,
		});

	await tab(message("account_tab_security_label")).click();
	await expect(page).toHaveURL(/\/app\/account\/security$/);
	await expect(
		accountCard(page, message("account_password_card_title")).getByRole(
			"button",
			{
				name: message("auth_change_password_form_submit_button"),
			},
		),
	).toBeVisible();

	await tab(message("account_tab_invitations_label")).click();
	await expect(page).toHaveURL(/\/app\/account\/invitations$/);
	await expect(
		accountCard(page, message("account_invitations_card_title")),
	).toBeVisible();

	await tab(message("account_tab_data_label")).click();
	await expect(page).toHaveURL(/\/app\/account\/data$/);
	await expect(
		accountCard(page, message("account_data_export_card_title")),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("account_legal_privacy_link"),
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("account_legal_terms_link"),
		}),
	).toBeVisible();

	await tab(message("account_tab_profile_label")).click();
	await expect(page).toHaveURL(/\/app\/account$/);
	await expect(
		accountCard(page, message("account_profile_card_title")),
	).toBeVisible();
});
