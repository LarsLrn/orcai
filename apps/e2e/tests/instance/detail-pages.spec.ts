import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test.describe.configure({
	mode: "serial",
});

test("instance: organisation and user pages link to each other through searchable lists", async ({
	org,
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(
		page,
		`/instance/organizations?query=${encodeURIComponent(org.slug)}`,
	);
	await page
		.getByRole("link", {
			name: org.name,
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("heading", {
			name: org.name,
		}),
	).toBeVisible();

	// The organisation's setup is shown read-only: its fixes act on an active organisation.
	await expect(
		page.getByRole("listitem", {
			name: message("readiness_check_provider_title"),
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("readiness_fix_action"),
		}),
	).toHaveCount(0);

	const member = org.users.member;
	await page
		.getByPlaceholder(message("instance_org_members_search_placeholder"))
		.fill(member.email);
	await expect(page.getByRole("row")).toHaveCount(2);
	await page
		.getByRole("link", {
			name: member.email,
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/instance/users/${member.id}`));

	const membership = page.getByRole("row").filter({
		hasText: org.name,
	});
	await expect(membership).toContainText(message("orgs_role_member_label"));
	await membership
		.getByRole("link", {
			name: org.name,
		})
		.click();
	await expect(
		page.getByRole("heading", {
			name: org.name,
		}),
	).toBeVisible();
});

test("instance: creating an organisation with an invited admin keeps the creator until they leave", async ({
	outbox,
	pageAsWellKnownAdmin,
}) => {
	const suffix = runId();
	const name = `E2E Invited Admin ${suffix}`;
	const email = `e2e-invited-admin-${suffix}@example.test`;

	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/organizations");
	await page
		.getByRole("button", {
			name: message("instance_organizations_create_button"),
		})
		.click();
	await page.getByLabel(message("orgs_form_name_label")).fill(name);
	await page
		.getByLabel(message("orgs_form_slug_label"))
		.fill(`e2e-invited-admin-${suffix}`);
	await page.getByText(message("orgs_form_initial_admin_invite_label")).click();
	await page
		.getByLabel(message("orgs_form_initial_admin_email_label"))
		.fill(email);
	await page
		.getByRole("button", {
			name: message("orgs_form_submit_button"),
		})
		.click();

	await expect
		.poll(
			async () =>
				(await outbox.latestFor(email, "organization.invited"))?.payload,
		)
		.toMatchObject({
			organizationName: name,
			role: "admin",
		});

	await page
		.getByRole("link", {
			name,
			exact: true,
		})
		.click();
	// The creator administers it until the invitee joins, then leaves from here.
	await expect(
		page.getByRole("button", {
			name: message("instance_org_member_leave_action"),
		}),
	).toBeVisible();
});
