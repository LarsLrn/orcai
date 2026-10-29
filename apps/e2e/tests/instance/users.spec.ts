import { userIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { signIn } from "../../fixtures/auth";
import { waitForLink } from "../../fixtures/auth/outbox";
import { enrolTwoFactor } from "../../fixtures/auth/two-factor";
import { rejection } from "../../fixtures/authorization";
import { WELL_KNOWN_ADMIN } from "../../fixtures/constants";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import {
	addMember,
	createThrowawayUser,
	memberRow,
} from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

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
	// Each row counts its organisations; the user page names them.
	const firstRow = memberRow(page, first.email);
	const secondRow = memberRow(page, second.email);
	await expect(firstRow).toBeVisible();
	await expect(secondRow).toBeVisible();
	await expect(
		firstRow.getByRole("cell", {
			name: "1",
			exact: true,
		}),
	).toBeVisible();

	await secondRow
		.getByRole("link", {
			name: second.name,
		})
		.click();
	const membership = page.getByRole("row").filter({
		hasText: other.name,
	});
	await expect(membership).toContainText(message("orgs_role_manager_label"));
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

	await expect(memberRow(page, wanted.email)).toBeVisible();
	await expect(memberRow(page, other.email)).toBeVisible();

	await page
		.getByPlaceholder(message("instance_users_search_placeholder"))
		.fill(wanted.email);

	await expect(memberRow(page, other.email)).toHaveCount(0);
	await expect(memberRow(page, wanted.email)).toBeVisible();
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

	const row = memberRow(page, user.email);
	await expect(row).toBeVisible();
	await expect(row).toContainText(message("common_status_active_label"));

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
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
			name: message("common_more_actions"),
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

	const row = memberRow(page, user.email);
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
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

	const row = memberRow(page, user.email);
	await expect(row).toContainText(
		message("instance_users_table_two_factor_on_label"),
	);

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
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

test("instance: the users page makes an account an instance admin and back", async ({
	api,
	org,
	outbox,
	pageAsWellKnownAdmin,
}) => {
	const user = await createThrowawayUser(baseURL(), `instance-role-${runId()}`);
	await addMember(api, org, user);
	const asUser = createApiClient(baseURL(), user.session.cookieHeader);
	const listUsers = () =>
		asUser.user.listAll({
			pageIndex: 0,
			pageSize: 1,
		});
	expect((await rejection(listUsers())).code).toBe("FORBIDDEN");

	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/users");
	const row = memberRow(page, user.email);
	await expect(row).toContainText(
		message("instance_users_table_instance_role_user_label"),
	);

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_promote_menu_item"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("users_promote_confirm_button"),
			exact: true,
		})
		.click();

	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toContainText(
		message("instance_users_table_instance_role_admin_label"),
	);
	expect(
		await waitForLink(outbox, user.email, "auth.instance-admin-granted"),
	).toMatch(/\/app\/account\/security$/);
	expect((await listUsers()).rowCount).toBeGreaterThan(0);

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_demote_menu_item"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("users_demote_confirm_button"),
			exact: true,
		})
		.click();

	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toContainText(
		message("instance_users_table_instance_role_user_label"),
	);
	expect(
		await waitForLink(outbox, user.email, "auth.instance-admin-revoked"),
	).toMatch(/\/app\/account\/security$/);
	expect((await rejection(listUsers())).code).toBe("FORBIDDEN");
});

test("instance: nobody changes their own instance role, and only instance admins change one", async ({
	api,
	org,
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/users");
	await page
		.getByPlaceholder(message("instance_users_search_placeholder"))
		.fill(WELL_KNOWN_ADMIN.email);
	// Other accounts' addresses end in the same text, so match the whole cell.
	const ownRow = page.getByRole("row").filter({
		has: page.getByRole("cell", {
			name: WELL_KNOWN_ADMIN.email,
			exact: true,
		}),
	});
	await expect(ownRow).toContainText(
		message("instance_users_table_instance_role_admin_label"),
	);
	await expect(
		ownRow.getByRole("button", {
			name: message("common_more_actions"),
		}),
	).toHaveCount(0);

	const self = await signIn(baseURL(), WELL_KNOWN_ADMIN);
	const ownDemotion = await rejection(
		createApiClient(baseURL(), self.cookieHeader).user.setInstanceRole({
			userId: userIdSchema.parse(self.userId),
			role: "user",
		}),
	);
	expect(ownDemotion.data).toMatchObject({
		reason: "SELF_INSTANCE_ROLE_CHANGE_FORBIDDEN",
	});

	const user = await createThrowawayUser(baseURL(), `self-promote-${runId()}`);
	await addMember(api, org, user);
	const selfPromotion = await rejection(
		createApiClient(baseURL(), user.session.cookieHeader).user.setInstanceRole({
			userId: user.id,
			role: "admin",
		}),
	);
	expect(selfPromotion.data).toMatchObject({
		reason: "INSTANCE_ADMIN_REQUIRED",
	});
});
