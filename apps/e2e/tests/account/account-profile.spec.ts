import { saveProfileName } from "../../fixtures/account/forms";
import {
	accountCard,
	openAccountPage,
	userMenu,
} from "../../fixtures/account/navigation";
import { createAccountUser, nameOf } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { runId } from "../../fixtures/organisation";

test("account: a user changes the display name through the profile card", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "profile",
		admin: api.as("admin"),
		organisation: org,
	});
	const newName = `E2E Account Renamed ${runId()}`;
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);
		await expect(userMenu(page, user.name)).toBeVisible();

		await saveProfileName(page, newName, user.api);

		// The sidebar and the stats card read `auth.user` from the router
		// context, which the root route fills once per document from the
		// session on the server, so the new name is there on the next load.
		await openAccountPage(page);
		await expect(userMenu(page, newName)).toBeVisible();
		await expect(page.getByText(newName).first()).toBeVisible();
		await expect(
			accountCard(page, "Your Profile").getByLabel("Name", {
				exact: true,
			}),
		).toHaveValue(newName);
	} finally {
		await context.close();
	}
});

test("account: saving the profile reports that it succeeded", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "profile-toast",
		admin: api.as("admin"),
		organisation: org,
	});
	const newName = `E2E Account Toast ${runId()}`;
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);
		await saveProfileName(page, newName, user.api);

		await expect(page.getByText("Profile updated successfully!")).toBeVisible();
		await expect(page.getByText("Failed to update profile")).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test("account: an empty display name is refused", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "profile-empty",
		admin: api.as("admin"),
		organisation: org,
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);

		const name = accountCard(page, "Your Profile").getByLabel("Name", {
			exact: true,
		});

		/** Late hydration: retry the whole attempt.
		 * The message appears under the field and in the error list. */
		await expect(async () => {
			await name.fill("");
			await page
				.getByRole("button", {
					name: "Save Profile",
				})
				.click();
			await expect(page.getByText("Name is required").first()).toBeVisible({
				timeout: 5_000,
			});
		}).toPass({
			timeout: 25_000,
		});

		await expect(nameOf(user.api)).resolves.toBe(user.name);
	} finally {
		await context.close();
	}
});
