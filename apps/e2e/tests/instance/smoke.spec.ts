import {
	INSTANCE_ORGANISATION,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test.describe.configure({
	mode: "serial",
});

test("the well-known admin signs in and reads instance data", async ({
	page,
}) => {
	await open(page, "/login");

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel(message("common_email_label"))
				.fill(WELL_KNOWN_ADMIN.email);
			await page
				.getByLabel(message("common_password_label"), {
					exact: true,
				})
				.fill(WELL_KNOWN_ADMIN.password);
		},
		submit: message("auth_signin_form_submit_button"),
		// Sign-in leaves the login page before the app knows which
		// organisation is active, so any other URL counts.
		until: /^(?!.*\/login).*$/,
	});

	await enterApp(page, INSTANCE_ORGANISATION.slug);

	await open(page, "/app/orgs");
	await expect(
		page.getByRole("heading", {
			name: message("instance_organizations_page_title"),
		}),
	).toBeVisible();
	// The active organisation in the sidebar comes from the database; the table
	// itself paginates, so its rows are not a stable place to look for a name.
	await expect(
		page.getByRole("button", {
			name: INSTANCE_ORGANISATION.name,
		}),
	).toBeVisible();
});
