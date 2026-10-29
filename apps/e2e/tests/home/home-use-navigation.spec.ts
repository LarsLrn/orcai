import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test("home: an admin of an unfinished organisation can open Use and still lands on Manage by default", async ({
	api,
	orgs,
	pageAs,
}) => {
	const fresh = await orgs.create("E2E Home Navigation");
	// The initial tour's modal would cover the tabs.
	await api.as("admin", fresh).user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const admin = await pageAs("admin", fresh);
	await enterApp(admin, fresh.slug);
	await open(admin, "/app");
	await expect(admin).toHaveURL(/\/app\/manage$/);

	const useTab = admin.getByRole("tab", {
		name: message("home_view_use_tab"),
	});
	await useTab.click();
	await expect(admin).toHaveURL(/\/app\?view=use$/);
	const askHeading = admin.getByRole("heading", {
		name: message("home_ask_section_title"),
	});
	await expect(askHeading).toBeVisible();

	// The choice is in the URL, so a reload and a new tab keep Use.
	await admin.reload();
	await expect(admin).toHaveURL(/\/app\?view=use$/);
	await expect(askHeading).toBeVisible();
	const newTab = await admin.context().newPage();
	await open(newTab, "/app?view=use");
	await expect(newTab).toHaveURL(/\/app\?view=use$/);
	await expect(
		newTab.getByRole("heading", {
			name: message("home_ask_section_title"),
		}),
	).toBeVisible();
	await newTab.close();

	// Manage and back to Use still works, and a plain visit still opens Manage.
	await admin
		.getByRole("tab", {
			name: message("home_view_manage_tab"),
		})
		.click();
	await expect(admin).toHaveURL(/\/app\/manage$/);
	await useTab.click();
	await expect(admin).toHaveURL(/\/app\?view=use$/);

	await open(admin, "/app");
	await expect(admin).toHaveURL(/\/app\/manage$/);
});
