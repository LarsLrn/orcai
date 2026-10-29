import { PNG, saveImageThroughDialog } from "../../fixtures/account/images";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
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

	await expect(name).toHaveValue(created.name);
	await expect(slug).toHaveValue(created.slug);
	await expect(page.getByText(created.id)).toBeVisible();

	const renamed = `${created.name} Renamed`;
	const reslugged = `${created.slug}-renamed`;

	await submitForm(page, {
		fill: async () => {
			await name.fill(renamed);
			await slug.fill(reslugged);
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
});

test("orgs: an admin sets the logo and it shows on the organisation picker", async ({
	api,
	orgs,
	pageAs,
	pageAsWellKnownAdmin,
}) => {
	test.slow();

	const created = await orgs.create(`E2E Orgs Logo ${runId()}`);
	const page = await pageAs("admin", created);

	await enterApp(page, created.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);
	await saveImageThroughDialog(
		page,
		page.getByRole("button", {
			name: message("images_logo_change_button"),
		}),
		PNG,
	);

	const found = await api.as("admin", created).organization.find({
		id: created.id,
	});
	expect(found.data.logo).toMatch(
		new RegExp(`^/api/images/organizations/${created.id}/[0-9a-f-]+\\.webp$`),
	);

	// The well-known admin belongs to every organisation, so the picker stays.
	const picker = await pageAsWellKnownAdmin();
	await open(picker, "/select-organization");
	await picker
		.getByPlaceholder(message("select_organisation_page_search_placeholder"))
		.fill(created.name);
	await expect(
		picker
			.locator('[data-slot="card"]')
			.filter({
				hasText: `@${created.slug}`,
			})
			.getByRole("img", {
				name: created.name,
			}),
	).toHaveAttribute("src", found.data.logo ?? "");

	await open(page, "/app/organization");
	await page
		.getByRole("button", {
			name: message("images_logo_remove_button"),
		})
		.click();
	await expect(
		page.getByRole("button", {
			name: message("images_logo_remove_button"),
		}),
	).toHaveCount(0);
	expect(
		(
			await api.as("admin", created).organization.find({
				id: created.id,
			})
		).data.logo,
	).toBeNull();
});
