import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { openGuarded } from "../../fixtures/orgs/navigation";

test("orgs: an admin edits the settings of its active organisation", async ({
	api,
	orgs,
	pageAs,
}) => {
	test.slow();

	// A throwaway organisation, because renaming the worker's own would confuse
	// the rest of the slice.
	const created = await orgs.create(`E2E Orgs Settings ${runId()}`);
	const page = await pageAs("admin", created);

	await enterApp(page, created.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);

	const name = page.getByLabel(message("orgs_form_name_label"));
	const slug = page.getByLabel(message("orgs_form_slug_label"));
	const logo = page.getByLabel(message("orgs_form_logo_label"));

	await expect(name).toHaveValue(created.name);
	await expect(slug).toHaveValue(created.slug);
	await expect(page.getByText(created.id)).toBeVisible();

	const renamed = `${created.name} Renamed`;
	const reslugged = `${created.slug}-renamed`;
	const logoUrl = `https://example.org/${reslugged}.svg`;

	await submitForm(page, {
		fill: async () => {
			await name.fill(renamed);
			await slug.fill(reslugged);
			await logo.fill(logoUrl);
		},
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});

	// The sidebar's user menu carries the organisation name.
	await expect(
		page.getByRole("button", {
			name: renamed,
		}),
	).toBeVisible();
	await expect(name).toHaveValue(renamed);

	const found = await api.as("admin", created).organization.find({
		id: created.id,
	});
	expect(found.data.name).toBe(renamed);
	expect(found.data.slug).toBe(reslugged);
	expect(found.data.logo).toBe(logoUrl);
});
