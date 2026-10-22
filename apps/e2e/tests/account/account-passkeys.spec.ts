import { openAccountPage } from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { waitForLink } from "../../fixtures/auth/outbox";
import {
	addPasskey,
	addVirtualAuthenticator,
	dropSession,
} from "../../fixtures/auth/passkey";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("account: a user adds a passkey, signs in with it alone, and deletes it", async ({
	api,
	appBaseURL,
	browser,
	outbox,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "passkey",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		const authenticator = await addVirtualAuthenticator(page);
		await addPasskey(page);
		expect(await authenticator.credentials()).toHaveLength(1);
		expect(await waitForLink(outbox, user.email, "auth.passkey-added")).toMatch(
			/\/app\/account\/security$/,
		);

		await dropSession(page);
		await open(page, "/login");
		await page
			.getByRole("button", {
				name: message("auth_signin_passkey_button"),
			})
			.click();
		await expect(page).toHaveURL(/\/app(\/|$)/);

		await openAccountPage(page, "security");
		await page
			.getByRole("button", {
				name: message("passkey_delete_button", {
					name: message("passkey_default_name"),
				}),
			})
			.click();
		await page
			.getByRole("button", {
				name: message("common_delete_button"),
				exact: true,
			})
			.click();
		await expect(page.getByText(message("passkey_list_empty"))).toBeVisible();
	} finally {
		await context.close();
	}
});
