import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { openGuarded } from "../../fixtures/orgs/navigation";

/** The id the app puts in the detail URL once an organisation exists. */
const ORGANISATION_URL = /\/en\/app\/orgs\/([0-9a-f-]{36})$/;

test("orgs: an admin edits the settings of its organisation", async ({
	api,
	orgs,
	pageAs,
}) => {
	test.slow();

	// Creating an organisation is an instance action, so the organisation comes
	// from the fixture, which runs as the well-known admin. A throwaway one,
	// because renaming the worker's own would confuse the rest of the slice.
	const created = await orgs.create(`E2E Orgs Settings ${runId()}`);
	const page = await pageAs("admin", created);

	await enterApp(page, created.slug);

	// Reached by id; the detail page is the only place the slug is shown.
	await openGuarded(page, `/en/app/orgs/${created.id}`, created.name);
	await expect(page.getByText(created.slug)).toBeVisible();

	const renamed = `${created.name} Renamed`;

	await openGuarded(
		page,
		`/en/app/orgs/${created.id}/edit`,
		"Edit Organisation",
	);

	// Saving sends the browser back to the detail page it came from.
	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("Organisation Name").fill(renamed);
			await page.getByLabel("Slug").fill(created.slug);
		},
		submit: "Save Organisation",
		until: ORGANISATION_URL,
	});

	await openGuarded(page, `/en/app/orgs/${created.id}`, renamed);

	const found = await api.as("admin", created).organization.find({
		id: created.id,
	});
	expect(found.data.name).toBe(renamed);
	expect(found.data.slug).toBe(created.slug);
});
