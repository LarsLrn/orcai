import {
	INSTANCE_ORGANISATION,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";

test.describe.configure({
	mode: "serial",
});

test("the well-known admin signs in and reads instance data", async ({
	page,
}) => {
	await open(page, "/en/login");

	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("Email").fill(WELL_KNOWN_ADMIN.email);
			await page
				.getByLabel("Password", {
					exact: true,
				})
				.fill(WELL_KNOWN_ADMIN.password);
		},
		submit: "Login",
		// Sign-in leaves the login page before the app knows which
		// organisation is active, so any other URL counts.
		until: /^(?!.*\/en\/login).*$/,
	});

	await enterApp(page, INSTANCE_ORGANISATION.slug);

	await open(page, "/en/app/orgs");
	await expect(
		page.getByRole("heading", {
			name: "Organisations",
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
