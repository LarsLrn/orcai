import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test.describe.configure({
	mode: "serial",
});

/** Creating and deleting an organisation are instance actions, so these run as the well-known admin. */
const openInstanceOrganisations = async (page: Page): Promise<void> => {
	await open(page, "/en/instance/organizations");
	await expect(
		page.getByRole("heading", {
			name: "Organisations",
		}),
	).toBeVisible();
};

/** Open the create dialog, retrying late hydration until it answers. */
const openCreateDialog = async (page: Page): Promise<void> => {
	await expect(async () => {
		await page
			.getByRole("button", {
				name: "Create Organisation",
			})
			.click();
		await expect(
			page.getByRole("heading", {
				name: "Create Organisation",
			}),
		).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 20_000,
	});
};

test("instance: the organisations page creates an organisation", async ({
	api,
	pageAsWellKnownAdmin,
}) => {
	const suffix = runId();
	// Keep the slug unique across repeated no-reset runs.
	const name = `E2E Created ${suffix}`;
	const slug = `e2e-created-${suffix}`;

	const page = await pageAsWellKnownAdmin();
	await openInstanceOrganisations(page);
	await openCreateDialog(page);

	await page.getByLabel("Organisation Name").fill(name);
	await page.getByLabel("Slug").fill(slug);
	await page
		.getByRole("button", {
			name: "Save Organisation",
		})
		.click();

	// The list is newest first, so the organisation just created heads it.
	const row = page.getByRole("row").filter({
		hasText: slug,
	});
	await expect(row).toBeVisible();
	await expect(row).toContainText(name);

	const created = await api.asWellKnownAdmin().organization.listAll({
		pageIndex: 0,
		pageSize: 5,
		sort: [
			{
				id: "createdAt",
				desc: true,
			},
		],
	});
	const match = created.data.find((organisation) => organisation.slug === slug);
	expect(match?.name).toBe(name);
	// The creator becomes the first member of what it created.
	expect(match?.memberCount).toBe(1);
});

test("instance: the search narrows the organisations page", async ({
	orgs,
	pageAsWellKnownAdmin,
}) => {
	const wanted = await orgs.create("E2E Instance Search");
	const other = await orgs.create("E2E Instance Hidden");

	const page = await pageAsWellKnownAdmin();
	await openInstanceOrganisations(page);

	const rowFor = (slug: string) =>
		page.getByRole("row").filter({
			hasText: slug,
		});

	await page.getByPlaceholder("Search organisations...").fill(wanted.slug);

	await expect(rowFor(wanted.slug)).toBeVisible();
	await expect(rowFor(other.slug)).toHaveCount(0);
});

test("instance: the organisation form refuses an empty name and an empty slug", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await openInstanceOrganisations(page);
	await openCreateDialog(page);

	await page
		.getByRole("button", {
			name: "Save Organisation",
		})
		.click();

	await expect(page.getByText("Name is required")).toBeVisible();
	await expect(page.getByText("Slug is required")).toBeVisible();

	// A name alone leaves the slug complaint standing.
	await page.getByLabel("Organisation Name").fill(`E2E Invalid ${runId()}`);
	await expect(page.getByText("Name is required")).toHaveCount(0);
	await expect(page.getByText("Slug is required")).toBeVisible();

	await page.getByLabel("Slug").fill(`e2e-invalid-${runId()}`);
	await expect(page.getByText("Slug is required")).toHaveCount(0);
});

test("instance: the deletion dialog counts what goes and asks for the slug", async ({
	api,
	orgs,
	pageAsWellKnownAdmin,
}) => {
	test.slow();

	// A throwaway organisation: never the instance organisation, never the
	// worker's own, both of which the rest of the suite signs in to.
	const doomed = await orgs.create(`E2E Doomed ${runId()}`);

	const page = await pageAsWellKnownAdmin();
	await openInstanceOrganisations(page);

	const row = page.getByRole("row").filter({
		hasText: doomed.slug,
	});
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: "Open menu",
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: "Delete Organisation",
		})
		.click();

	const dialog = page.getByRole("dialog");

	// The counts are one list item each, matched exactly: "5 members" as a
	// substring of the dialog would also be satisfied by "15 members".
	await expect(
		dialog.getByText("5 members", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		dialog.getByText("1 group", {
			exact: true,
		}),
	).toBeVisible();

	const deleteButton = dialog.getByRole("button", {
		name: "Delete",
		exact: true,
	});
	await expect(deleteButton).toBeDisabled();

	// The wrong slug keeps it disabled; the right one enables it.
	await page.getByLabel(/to confirm/).fill(`${doomed.slug}-not`);
	await expect(deleteButton).toBeDisabled();
	await page.getByLabel(/to confirm/).fill(doomed.slug);
	await expect(deleteButton).toBeEnabled();
	await deleteButton.click();

	// The dialog is modal, so the rows behind it are hidden from the
	// accessibility tree while it is open: waiting for it to go is what makes
	// the row assertion mean anything.
	await expect(dialog).toHaveCount(0);
	await expect(row).toHaveCount(0);

	const remaining = await api.asWellKnownAdmin().organization.listAll({
		pageIndex: 0,
		pageSize: 10,
		sort: [
			{
				id: "createdAt",
				desc: true,
			},
		],
	});
	expect(
		remaining.data.some((organisation) => organisation.slug === doomed.slug),
	).toBe(false);
});
