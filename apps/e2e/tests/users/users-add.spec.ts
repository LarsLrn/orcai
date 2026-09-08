import { EMAIL_DOMAIN } from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { reachPage, userRow } from "../../fixtures/users/users";

/**
 * "Add User" on the users page is an invitation form: it never creates an
 * account, it queues an invitation per email address for the selected
 * organisation and role and then shows the invitations list.
 */
test("users: an admin invites a user from the users page", async ({
	org,
	pageAs,
}) => {
	const email = `e2e-users-invited-${runId()}@${EMAIL_DOMAIN}`;
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users/add", "Add User");

	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("User 1 Email").fill(email);
		},
		submit: "Create Invitations",
		until: /\/en\/app\/users\/invites/,
	});

	await expect(
		page.getByRole("heading", {
			name: "Organisation Invitations",
		}),
	).toBeVisible();

	const row = userRow(page, email);
	await expect(row).toBeVisible();
	await expect(row).toContainText("pending");
	await expect(row).toContainText("member");
});

test("users: the add form refuses an invalid email", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users/add", "Add User");

	// Repeated until the form is hydrated; before that the click submits nothing.
	await expect(async () => {
		await page.getByLabel("User 1 Email").fill("not-an-email");
		await page
			.getByRole("button", {
				name: "Create Invitations",
			})
			.click();
		await expect(
			page.getByText("Please fix the following errors:"),
		).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	await expect(
		page.getByText("Items[0] → Email: Field must be a valid email"),
	).toBeVisible();
	await expect(page).toHaveURL(/\/en\/app\/users\/add/);
});
