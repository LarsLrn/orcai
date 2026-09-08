import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import {
	addMember,
	createThrowawayUser,
	userRow,
} from "../../fixtures/users/users";

test.describe.configure({
	mode: "serial",
});

/** Instance > Users lists every account, independent of the active organisation. */
test("instance: the users page lists accounts from several organisations", async ({
	api,
	org,
	orgs,
	pageAsWellKnownAdmin,
}) => {
	const suffix = runId();
	const other = await orgs.create(`E2E Users ${suffix}`);
	const first = await createThrowawayUser(baseURL(), `inst-${suffix}-a`);
	const second = await createThrowawayUser(baseURL(), `inst-${suffix}-b`);
	await addMember(api, org, first);
	await addMember(api, other, second, "manager");

	const page = await pageAsWellKnownAdmin();
	await open(page, "/en/instance/users");
	await expect(
		page.getByRole("heading", {
			name: "Users",
		}),
	).toBeVisible();

	// The list is newest first and neither account belongs to the instance
	// organisation, so both prove the page is not scoped to one organisation.
	const firstRow = userRow(page, first.email);
	const secondRow = userRow(page, second.email);
	await expect(firstRow).toBeVisible();
	await expect(secondRow).toBeVisible();
	await expect(firstRow).toContainText(org.name);
	await expect(firstRow).toContainText("Member");
	await expect(secondRow).toContainText(other.name);
	await expect(secondRow).toContainText("Manager");
});

test("instance: the search narrows the users page", async ({
	api,
	org,
	pageAsWellKnownAdmin,
}) => {
	const suffix = runId();
	const wanted = await createThrowawayUser(baseURL(), `search-${suffix}`);
	const other = await createThrowawayUser(baseURL(), `hidden-${suffix}`);
	await addMember(api, org, wanted);
	await addMember(api, org, other);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/en/instance/users");

	await expect(userRow(page, wanted.email)).toBeVisible();
	await expect(userRow(page, other.email)).toBeVisible();

	await page.getByPlaceholder("Search users...").fill(wanted.email);

	await expect(userRow(page, other.email)).toHaveCount(0);
	await expect(userRow(page, wanted.email)).toBeVisible();
});

test("instance: the users page bans and unbans an account", async ({
	api,
	org,
	pageAsWellKnownAdmin,
}) => {
	const user = await createThrowawayUser(baseURL(), `banned-${runId()}`);
	await addMember(api, org, user);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/en/instance/users");

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();
	await expect(row).toContainText("Active");

	await row
		.getByRole("button", {
			name: "Open menu",
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: "Ban Account",
		})
		.click();
	await page
		.getByRole("button", {
			name: "Ban",
			exact: true,
		})
		.click();

	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toContainText("Banned");

	await row
		.getByRole("button", {
			name: "Open menu",
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: "Unban Account",
		})
		.click();

	await expect(row).toContainText("Active");
});

test("instance: the users page deletes an account", async ({
	api,
	org,
	pageAsWellKnownAdmin,
}) => {
	const user = await createThrowawayUser(baseURL(), `deleted-${runId()}`);
	await addMember(api, org, user);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/en/instance/users");

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: "Open menu",
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: "Delete Account",
		})
		.click();
	await page
		.getByRole("button", {
			name: "Delete",
			exact: true,
		})
		.click();

	// The confirmation is modal, so the row behind it is hidden from the
	// accessibility tree until the dialog goes.
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toHaveCount(0);

	const remaining = await api.asWellKnownAdmin().user.listAll({
		filters: {
			search: user.email,
		},
		pageIndex: 0,
		pageSize: 10,
	});
	expect(remaining.rowCount).toBe(0);
});
