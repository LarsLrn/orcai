import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import {
	addMember,
	createThrowawayUser,
	reachPage,
	rowMenuItems,
	userRow,
} from "../../fixtures/users/users";

test("users: an admin sees every member of the organisation", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "listed");
	await addMember(api, org, user);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users", "Users");

	// `user.list` is scoped to the active organisation, so the table holds one
	// user per role, the well-known admin that created the organisation, and
	// the user this spec just added, all on the first page. The search control
	// has its own spec; here the unique email is looked up as a row of the
	// scoped table.
	for (const role of [
		"admin",
		"manager",
		"member",
		"viewer",
	] as const) {
		await expect(userRow(page, org.users[role].email)).toBeVisible();
	}

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();
	await expect(row).toContainText(user.name);
	await expect(row).toContainText("Member");
	await expect(row).toContainText("Not verified");
});

test("users: a manager sees the users page but may not remove an admin", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "manager-view");
	await addMember(api, org, user);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users", "Users");

	await expect(userRow(page, user.email)).toBeVisible();
	await expect(userRow(page, org.users.admin.email)).toBeVisible();

	// A manager has `manage_members` but not `manage_organization`, so the app
	// offers no destructive action on a row that holds an admin.
	expect(await rowMenuItems(page, org.users.admin.email)).toEqual([
		"Edit User",
	]);
	await page.keyboard.press("Escape");

	expect(await rowMenuItems(page, user.email)).toEqual([
		"Edit User",
		"Remove from organisation",
	]);
});

test("users: a member and a viewer never see the users page", async ({
	org,
	pageAs,
}) => {
	for (const role of [
		"member",
		"viewer",
	] as const) {
		const page = await pageAs(role);
		await enterApp(page, org.slug);
		await open(page, "/en/app/users");

		// The route guard checks `manage_members` and sends the rest back to
		// the dashboard.
		await expect(page).toHaveURL(/\/en\/app$/);
		await expect(
			page.getByRole("heading", {
				name: "Users",
			}),
		).toHaveCount(0);
	}
});

test("users: an admin searches the organisation users by email", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "searched");
	await addMember(api, org, user);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users", "Users");

	await expect(userRow(page, user.email)).toBeVisible();
	await expect(userRow(page, org.users.admin.email)).toBeVisible();

	const search = page.getByPlaceholder("Search users...");
	await search.fill(user.email);

	// The search is debounced and goes to the server, so the table settles a
	// moment after the last keystroke.
	await expect(userRow(page, org.users.admin.email)).toHaveCount(0);
	await expect(userRow(page, user.email)).toBeVisible();

	// The admin's address next, so that the target row is gone before the name
	// is typed and the name is what brings it back.
	await search.fill(org.users.admin.email);
	await expect(userRow(page, user.email)).toHaveCount(0);
	await expect(userRow(page, org.users.admin.email)).toBeVisible();

	// A search over the name reaches the same row, and only that row.
	await search.fill(user.name);
	await expect(userRow(page, user.email)).toBeVisible();
	await expect(userRow(page, org.users.admin.email)).toHaveCount(0);

	await page
		.getByRole("button", {
			name: "Clear search",
		})
		.click();

	await expect(userRow(page, org.users.admin.email)).toBeVisible();
	await expect(userRow(page, user.email)).toBeVisible();
});
