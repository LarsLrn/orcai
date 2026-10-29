import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import {
	addMember,
	createThrowawayUser,
	memberRow,
	reachPage,
	rowMenuItems,
} from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

/**
 * The table holds 20 rows per page, newest member first, and the worker
 * organisation grows with every spec that adds a member to it. The role users
 * are its oldest members, so a page large enough for all of them is asked for
 * in the URL; the route coerces the search parameter.
 */
const MEMBERS_PATH = "/app/members?pageSize=200";

test("members: an admin sees every member of the organisation", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "listed");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, MEMBERS_PATH, message("members_page_title"));

	// `organizationMember.list` is scoped to the active organisation, so the table holds one
	// user per role, the well-known admin that created the organisation, and
	// the user this spec just added. The search control has its own spec; here
	// the unique email is looked up as a row of the scoped table.
	for (const role of [
		"admin",
		"manager",
		"member",
		"viewer",
	] as const) {
		await expect(memberRow(page, org.users[role].email)).toBeVisible();
	}

	const row = memberRow(page, user.email);
	await expect(row).toBeVisible();
	await expect(row).toContainText(user.name);
	await expect(row).toContainText(message("orgs_role_member_label"));
	await expect(row).toContainText(message("members_verification_not_verified"));
});

test("members: a manager sees the members page but may not remove an admin", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "manager-view");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await reachPage(page, MEMBERS_PATH, message("members_page_title"));

	await expect(memberRow(page, user.email)).toBeVisible();
	await expect(memberRow(page, org.users.admin.email)).toBeVisible();

	// A manager has `manage_members` but not `manage_organization`, so the app
	// offers no destructive action on a row that holds an admin.
	expect(await rowMenuItems(page, org.users.admin.email)).toEqual([
		message("members_table_edit_action"),
	]);
	await page.keyboard.press("Escape");

	expect(await rowMenuItems(page, user.email)).toEqual([
		message("members_table_edit_action"),
		message("members_remove_from_organisation_action"),
	]);
});

test("members: a member and a viewer never see the members page", async ({
	org,
	pageAs,
}) => {
	for (const role of [
		"member",
		"viewer",
	] as const) {
		const page = await pageAs(role);
		await enterApp(page, org.slug);
		await open(page, "/app/members");

		// The route guard checks `manage_members` and sends the rest back to
		// the dashboard.
		await expect(page).toHaveURL(/\/app$/);
		await expect(
			page.getByRole("heading", {
				name: message("members_page_title"),
			}),
		).toHaveCount(0);
	}
});

test("members: an admin searches the organisation members by email", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "searched");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, MEMBERS_PATH, message("members_page_title"));

	await expect(memberRow(page, user.email)).toBeVisible();
	await expect(memberRow(page, org.users.admin.email)).toBeVisible();

	const search = page.getByPlaceholder(
		message("members_list_search_placeholder"),
	);
	await search.fill(user.email);

	// The search is debounced and goes to the server, so the table settles a
	// moment after the last keystroke.
	await expect(memberRow(page, org.users.admin.email)).toHaveCount(0);
	await expect(memberRow(page, user.email)).toBeVisible();

	// The admin's address next, so that the target row is gone before the name
	// is typed and the name is what brings it back.
	await search.fill(org.users.admin.email);
	await expect(memberRow(page, user.email)).toHaveCount(0);
	await expect(memberRow(page, org.users.admin.email)).toBeVisible();

	// A search over the name reaches the same row, and only that row.
	await search.fill(user.name);
	await expect(memberRow(page, user.email)).toBeVisible();
	await expect(memberRow(page, org.users.admin.email)).toHaveCount(0);

	await page
		.getByRole("button", {
			name: message("data_table_search_clear_label"),
		})
		.click();

	await expect(memberRow(page, org.users.admin.email)).toBeVisible();
	await expect(memberRow(page, user.email)).toBeVisible();
});
