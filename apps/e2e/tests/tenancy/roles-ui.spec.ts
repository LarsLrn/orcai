import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

/** The management pages and the heading each one puts on the screen. */
const MANAGEMENT_PAGES = [
	{
		path: "/app/organization",
		heading: "Organisation",
	},
	{
		path: "/app/users",
		heading: "Users",
	},
];

test("a viewer is sent back from the management pages", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("viewer");
	await enterApp(page, org.slug);

	for (const managementPage of MANAGEMENT_PAGES) {
		await open(page, managementPage.path);

		// The route guard checks the organisation capability and redirects to
		// the dashboard when the viewer does not have it.
		await expect(page).toHaveURL(/\/app$/);
		await expect(
			page.getByRole("heading", {
				name: managementPage.heading,
			}),
		).toHaveCount(0);
	}
});

test("an admin reaches the management pages", async ({ org, pageAs }) => {
	const page = await pageAs("admin");
	await enterApp(page, org.slug);

	for (const managementPage of MANAGEMENT_PAGES) {
		await open(page, managementPage.path);

		await expect(
			page.getByRole("heading", {
				name: managementPage.heading,
			}),
		).toBeVisible();
	}
});

test("an organisation admin cannot enter instance management", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("admin");
	await enterApp(page, org.slug);

	for (const path of [
		"/instance/organizations",
		"/instance/users",
	]) {
		await open(page, path);

		// Home, or Manage while the worker organisation's setup is incomplete.
		await expect(page).toHaveURL(/\/app(\/manage)?$/);
	}

	await page
		.getByRole("button", {
			name: /E2E admin/,
		})
		.click();
	// The organisation entries prove the menu is open before its absence is read.
	await expect(
		page.getByRole("menuitem", {
			name: message("user_menu_switch_organisation_item"),
		}),
	).toBeVisible();
	await expect(
		page.getByRole("menuitem", {
			name: message("user_menu_manage_instance_item"),
		}),
	).toHaveCount(0);
});
