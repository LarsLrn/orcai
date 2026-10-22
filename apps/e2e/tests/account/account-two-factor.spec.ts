import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { waitForLink } from "../../fixtures/auth/outbox";
import { totpCode } from "../../fixtures/auth/two-factor";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";

test("account: a user sets up two-factor authentication and turning it off sends an email", async ({
	api,
	appBaseURL,
	browser,
	outbox,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "two-factor",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page, "security");
		const card = accountCard(page, message("two_factor_card_title"));
		await expect(
			card.getByText(message("two_factor_card_disabled_description")),
		).toBeVisible();

		await card
			.getByRole("button", {
				name: message("two_factor_enable_button"),
			})
			.click();
		await card
			.getByLabel(message("common_password_label"), {
				exact: true,
			})
			.fill(user.password);
		await card
			.getByRole("button", {
				name: message("two_factor_enrolment_start_button"),
			})
			.click();

		await expect(
			card.getByRole("img", {
				name: message("two_factor_enrolment_qr_label"),
			}),
		).toBeVisible();
		const setupKey = await card
			.getByLabel(message("two_factor_enrolment_secret_label"))
			.inputValue();
		await card
			.getByLabel(message("two_factor_code_label"))
			.fill(await totpCode(setupKey));
		await card
			.getByRole("button", {
				name: message("two_factor_enrolment_verify_button"),
			})
			.click();

		await expect(
			card
				.getByRole("list", {
					name: message("two_factor_backup_codes_list_label"),
				})
				.getByRole("listitem"),
		).toHaveCount(10);
		await card
			.getByRole("button", {
				name: message("two_factor_enrolment_done_button"),
			})
			.click();
		await expect(
			card.getByText(message("two_factor_card_enabled_description")),
		).toBeVisible();

		await card
			.getByRole("button", {
				name: message("two_factor_disable_button"),
			})
			.click();
		await card
			.getByLabel(message("common_password_label"), {
				exact: true,
			})
			.fill(user.password);
		await card
			.getByRole("button", {
				name: message("two_factor_disable_button"),
			})
			.click();
		await expect(
			card.getByText(message("two_factor_card_disabled_description")),
		).toBeVisible();

		expect(
			await waitForLink(outbox, user.email, "auth.two-factor-disabled"),
		).toMatch(/\/app\/account\/security$/);
	} finally {
		await context.close();
	}
});
