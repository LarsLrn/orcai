import { EMAIL_DOMAIN } from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
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
	await reachPage(page, "/app/users/add", message("users_add_page_title"));

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel(
					message("orgs_invitation_form_email_label", {
						position: 1,
					}),
				)
				.fill(email);
		},
		submit: "Create Invitations",
		until: /\/app\/users\/invites/,
	});

	await expect(
		page.getByRole("heading", {
			name: message("users_invites_page_title"),
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
	await reachPage(page, "/app/users/add", message("users_add_page_title"));

	// Repeated until the form is hydrated; before that the click submits nothing.
	await expect(async () => {
		await page
			.getByLabel(
				message("orgs_invitation_form_email_label", {
					position: 1,
				}),
			)
			.fill("not-an-email");
		await page
			.getByRole("button", {
				name: message("orgs_invitation_form_submit_button"),
			})
			.click();
		await expect(
			page.getByText(message("forms_validation_errors_title")),
		).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	await expect(
		page.getByText("Items[0] → Email: Field must be a valid email"),
	).toBeVisible();
	await expect(page).toHaveURL(/\/app\/users\/add/);
});
