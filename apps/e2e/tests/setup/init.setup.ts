import { createApiClient } from "../../fixtures/api";
import {
	INSTANCE_ORGANISATION,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { baseURL } from "../../fixtures/env";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("initialises the instance with the well-known admin", async ({ page }) => {
	const api = createApiClient(baseURL());
	const before = await api.bootstrap.status({});

	test.skip(
		before.data.initialized,
		"Instance already initialised; reusing the well-known admin",
	);

	await open(page, "/init");

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel(message("auth_init_form_organization_name_label"))
				.fill(INSTANCE_ORGANISATION.name);
			await page
				.getByLabel(message("auth_init_form_organization_slug_label"))
				.fill(INSTANCE_ORGANISATION.slug);
			await page
				.getByLabel(message("auth_init_form_admin_name_label"))
				.fill(WELL_KNOWN_ADMIN.name);
			await page
				.getByLabel(message("auth_init_form_admin_email_label"))
				.fill(WELL_KNOWN_ADMIN.email);
			await page
				.getByLabel(message("common_password_label"), {
					exact: true,
				})
				.fill(WELL_KNOWN_ADMIN.password);
			await page
				.getByLabel(message("auth_init_form_confirm_password_label"))
				.fill(WELL_KNOWN_ADMIN.password);
			await page
				.getByRole("switch", {
					name: message("auth_init_form_privacy_consent_label"),
				})
				.check();
		},
		submit: message("auth_init_form_submit_button"),
		until: /\/(app|login)/,
	});

	const after = await api.bootstrap.status({});
	expect(after.data.initialized).toBe(true);
});
