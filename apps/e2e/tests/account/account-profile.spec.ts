import { nameOf, saveProfileName } from "../../fixtures/account/forms";
import {
	accountCard,
	openAccountPage,
	userMenu,
} from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { runId } from "../../fixtures/organisation";
import { createMember } from "../../fixtures/users";

test("account: a user changes the display name through the profile card", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "profile",
		admin: api.as("admin"),
	});
	const newName = `E2E Account Renamed ${runId()}`;
	const page = await pageForSession(user.session);

	await openAccountPage(page);
	await expect(userMenu(page, user.name)).toBeVisible();

	await saveProfileName(page, newName, user.api);

	// The sidebar and the stats card show it without a reload.
	await expect(userMenu(page, newName)).toBeVisible();
	await expect(page.getByText(newName).first()).toBeVisible();
	await expect(
		accountCard(page, message("account_profile_card_title")).getByLabel(
			message("users_profile_form_name_label"),
			{
				exact: true,
			},
		),
	).toHaveValue(newName);
});

test("account: saving the profile reports that it succeeded", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "profile-toast",
		admin: api.as("admin"),
	});
	const newName = `E2E Account Toast ${runId()}`;
	const page = await pageForSession(user.session);

	await openAccountPage(page);
	await saveProfileName(page, newName, user.api);

	await expect(
		page.getByText(message("account_profile_toast_success")),
	).toBeVisible();
	await expect(
		page.getByText(message("account_profile_toast_error")),
	).toHaveCount(0);
});

test("account: an empty display name is refused", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "profile-empty",
		admin: api.as("admin"),
	});
	const page = await pageForSession(user.session);

	await openAccountPage(page);

	const name = accountCard(
		page,
		message("account_profile_card_title"),
	).getByLabel(message("users_profile_form_name_label"), {
		exact: true,
	});

	await name.fill("");
	await page
		.getByRole("button", {
			name: message("users_profile_form_submit_button"),
		})
		.click();
	// The message appears under the field and in the error list.
	await expect(
		page.getByText(message("error_validation_required")).first(),
	).toBeVisible();

	await expect(nameOf(user.api)).resolves.toBe(user.name);
});
