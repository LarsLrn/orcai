import { createApiClient } from "../../fixtures/api";
import {
	INSTANCE_ORGANISATION,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { baseURL } from "../../fixtures/env";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";

test("initialises the instance with the well-known admin", async ({ page }) => {
	const api = createApiClient(baseURL());
	const before = await api.bootstrap.status({});

	test.skip(
		before.data.initialized,
		"Instance already initialised; reusing the well-known admin",
	);

	await open(page, "/en/init");

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel("Organisation Name")
				.fill(INSTANCE_ORGANISATION.name);
			await page
				.getByLabel("Organisation Slug")
				.fill(INSTANCE_ORGANISATION.slug);
			await page.getByLabel("Admin Name").fill(WELL_KNOWN_ADMIN.name);
			await page.getByLabel("Admin Email").fill(WELL_KNOWN_ADMIN.email);
			await page
				.getByLabel("Password", {
					exact: true,
				})
				.fill(WELL_KNOWN_ADMIN.password);
			await page.getByLabel("Confirm Password").fill(WELL_KNOWN_ADMIN.password);
			await page
				.getByRole("switch", {
					name: "Privacy Consent",
				})
				.check();
		},
		submit: "Initialize Instance",
		until: /\/en\/(app|login)/,
	});

	const after = await api.bootstrap.status({});
	expect(after.data.initialized).toBe(true);
});
