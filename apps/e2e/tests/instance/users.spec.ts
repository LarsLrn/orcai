import { signIn } from "../../fixtures/auth";
import { waitForLink } from "../../fixtures/auth/outbox";
import { enrolTwoFactor } from "../../fixtures/auth/two-factor";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
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
	await open(page, "/instance/users");
	await expect(
		page.getByRole("heading", {
			name: message("instance_users_page_title"),
		}),
	).toBeVisible();

	// The list is newest first and neither account belongs to the instance
	// organisation, so both prove the page is not scoped to one organisation.
	const firstRow = userRow(page, first.email);
	const secondRow = userRow(page, second.email);
	await expect(firstRow).toBeVisible();
	await expect(secondRow).toBeVisible();
	await expect(firstRow).toContainText(org.name);
	await expect(firstRow).toContainText(message("orgs_role_member_label"));
	await expect(secondRow).toContainText(other.name);
	await expect(secondRow).toContainText(message("orgs_role_manager_label"));
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
	await open(page, "/instance/users");

	await expect(userRow(page, wanted.email)).toBeVisible();
	await expect(userRow(page, other.email)).toBeVisible();

	await page
		.getByPlaceholder(message("instance_users_search_placeholder"))
		.fill(wanted.email);

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
	await open(page, "/instance/users");

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();
	await expect(row).toContainText(message("common_status_active_label"));

	await row
		.getByRole("button", {
			name: message("common_row_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_ban_menu_item"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("users_ban_confirm_button"),
			exact: true,
		})
		.click();

	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toContainText(
		message("instance_users_table_status_banned_label"),
	);

	await row
		.getByRole("button", {
			name: message("common_row_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_unban_menu_item"),
		})
		.click();

	await expect(row).toContainText(message("common_status_active_label"));
});

test("instance: the users page deletes an account", async ({
	api,
	org,
	pageAsWellKnownAdmin,
}) => {
	const user = await createThrowawayUser(baseURL(), `deleted-${runId()}`);
	await addMember(api, org, user);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/users");

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: message("common_row_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_delete_menu_item"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_delete_button"),
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

test("instance: the users page resets an account's two-factor authentication", async ({
	api,
	org,
	outbox,
	pageAsWellKnownAdmin,
}) => {
	const user = await createThrowawayUser(baseURL(), `two-factor-${runId()}`);
	await addMember(api, org, user);
	await enrolTwoFactor(baseURL(), user.session, user.password);
	// A password alone now only reaches the second step.
	await expect(signIn(baseURL(), user)).rejects.toThrow();

	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/users");

	const row = userRow(page, user.email);
	await expect(row).toContainText(
		message("instance_users_table_two_factor_on_label"),
	);

	await row
		.getByRole("button", {
			name: message("common_row_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_reset_two_factor_menu_item"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("users_reset_two_factor_confirm_button"),
			exact: true,
		})
		.click();

	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toContainText(
		message("instance_users_table_two_factor_off_label"),
	);
	expect(
		await waitForLink(outbox, user.email, "auth.two-factor-reset"),
	).toMatch(/\/app\/account\/security$/);
	expect((await signIn(baseURL(), user)).userId).toBe(user.id);
});
