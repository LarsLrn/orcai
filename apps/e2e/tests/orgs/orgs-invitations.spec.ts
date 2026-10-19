import { waitForLink } from "../../fixtures/auth/outbox";
import { USER_PASSWORD } from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import {
	INVITED_NOTIFICATION,
	invitationEmail,
	inviteEmail,
	organisationRoleOf,
	registerFromInvitation,
} from "../../fixtures/orgs/invitations";
import { createOrgsUser } from "../../fixtures/orgs/members";
import { openGuarded } from "../../fixtures/orgs/navigation";
import { chooseRole } from "../../fixtures/orgs/roles";

test("orgs: an admin invites an address through the form and the link reaches the outbox", async ({
	api,
	org,
	outbox,
	pageAs,
}) => {
	test.slow();

	const email = invitationEmail("form");
	const page = await pageAs("admin");

	await enterApp(page, org.slug);
	await openGuarded(page, "/app/users/add", message("users_add_page_title"));

	// The form starts on the active organisation and on "Member"; only the
	// role and the address are worth saying out loud.
	await chooseRole(page, "member", "viewer");

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
		submit: message("orgs_invitation_form_submit_button"),
		until: /\/app\/users\/invites/,
	});

	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);
	expect(link).toContain("register?inv=");

	const queued = await outbox.latestFor(email, INVITED_NOTIFICATION);
	expect(queued?.payload.role).toBe("viewer");
	expect(queued?.payload.organizationName).toBe(org.name);

	// The invitation the form created is the admin's own, so the list it
	// landed on shows it.
	await expect(page.getByText(email)).toBeVisible();

	const invitations = await api.as("admin").organizationInvitation.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	const created = invitations.data.find(
		(invitation) => invitation.email === email,
	);
	expect(created?.role).toBe("viewer");
	expect(created?.status).toBe("pending");
});

test("orgs: an invited visitor registers from the link and joins with the invited role", async ({
	api,
	browser,
	org,
	outbox,
}) => {
	test.slow();

	const email = invitationEmail("register");
	await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email,
		role: "viewer",
	});

	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);
	const context = await browser.newContext({
		locale: "en",
	});
	const page = await context.newPage();

	try {
		await registerFromInvitation(page, link, {
			name: "E2E Orgs Invitee",
			password: USER_PASSWORD,
			organisationName: org.name,
		});

		// Signing up consumes the invitation, so the membership is already
		// there and the one organisation it joined is the active one: the
		// selection page has nothing to ask and hands the visitor to the app,
		// without an email step in between.
		await expect(page).toHaveURL(/\/app(\/|$)/);

		// The sign-up hook grants the membership outside any oRPC response, so
		// there is no zedToken to make the first reads of it fresh.
		await expect
			.poll(async () => await organisationRoleOf(api.as("admin"), email), {
				timeout: 15_000,
			})
			.toBe("viewer");
	} finally {
		await context.close();
	}
});

test("orgs: an existing user accepts a pending invitation from the selection page", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	test.slow();

	const user = await createOrgsUser(appBaseURL, "invited-existing");
	await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "manager",
	});

	const context = await browser.newContext({
		storageState: user.session.storageState,
		locale: "en",
	});
	const page = await context.newPage();

	try {
		await open(page, "/select-organization");
		await expect(
			page.getByText(
				message("select_organisation_page_pending_invitations_title"),
			),
		).toBeVisible();
		// The invitation carries the organisation's name and slug, so the card
		// names them without reading an organisation the user is not in yet.
		await expect(
			page.getByText(`@${org.slug}`, {
				exact: true,
			}),
		).toBeVisible();

		await page
			.getByRole("button", {
				name: message("orgs_invitation_accept_button"),
			})
			.click();
		await expect(page).toHaveURL(/\/app(\/|$)/);

		expect(await organisationRoleOf(api.as("admin"), user.email)).toBe(
			"manager",
		);
	} finally {
		await context.close();
	}
});

test("orgs: a revoked invitation no longer opens the registration form", async ({
	api,
	browser,
	org,
	outbox,
	pageAs,
}) => {
	test.slow();

	const email = invitationEmail("revoked");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email,
		role: "member",
	});

	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);
	const page = await pageAs("admin");

	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/users/invites",
		message("users_invites_page_title"),
	);

	// The list is sorted newest first, so the invitation this test just
	// created is on the first page.
	const row = page.getByRole("row").filter({
		hasText: email,
	});
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: message("common_row_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("users_invites_table_delete_action"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_delete_button"),
			exact: true,
		})
		.click();

	await expect(row).toHaveCount(0);

	const validation = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(validation.data.isValid).toBe(false);
	expect(validation.data.reason).toBe("not_found");

	const context = await browser.newContext({
		locale: "en",
	});
	const visitor = await context.newPage();

	try {
		await open(visitor, link);
		await expect(
			visitor.getByText(
				message("auth_register_page_invitation_not_found_title"),
			),
		).toBeVisible();
		await expect(
			visitor.getByRole("button", {
				name: message("auth_signup_form_submit_button"),
			}),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test("orgs: the invitations list carries only the inviter's own invitations", async ({
	api,
	org,
	pageAs,
}) => {
	test.slow();

	const mine = invitationEmail("mine");
	await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: mine,
		role: "member",
	});

	// A manager may invite too, and the list is scoped to what the caller sent
	// or received, so this one stays out of the admin's view.
	const theirs = invitationEmail("theirs");
	await inviteEmail(api.as("manager"), {
		organizationId: org.id,
		email: theirs,
		role: "member",
	});

	const listed = await api.as("admin").organizationInvitation.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	const emails = listed.data.map((invitation) => invitation.email);
	expect(emails).toContain(mine);
	expect(emails).not.toContain(theirs);

	const byManager = await api.as("manager").organizationInvitation.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(byManager.data.map((invitation) => invitation.email)).toContain(
		theirs,
	);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/users/invites",
		message("users_invites_page_title"),
	);

	// Both invitations are newer than anything else this admin sent, so the
	// first page of the list settles the question.
	await expect(page.getByText(mine)).toBeVisible();
	await expect(page.getByText(theirs)).toHaveCount(0);
});
