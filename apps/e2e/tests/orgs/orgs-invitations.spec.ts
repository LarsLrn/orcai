import { waitForLink } from "../../fixtures/auth/outbox";
import { expectForbidden } from "../../fixtures/authorization";
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
	await openGuarded(
		page,
		"/app/members/add",
		message("members_add_page_title"),
	);

	// The form starts on "Member"; only the role and the address are worth
	// saying out loud.
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
		until: /\/app\/members\/invitations/,
	});

	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);
	expect(link).toContain("register?inv=");

	const queued = await outbox.latestFor(email, INVITED_NOTIFICATION);
	expect(queued?.payload.role).toBe("viewer");
	expect(queued?.payload.organizationName).toBe(org.name);

	// The list the form lands on is newest first, so it shows the invitation.
	await expect(page.getByText(email)).toBeVisible();

	const invitations = await api.as("admin").organizationInvitation.list({
		pageIndex: 0,
		pageSize: 100,
		sort: [
			{
				id: "createdAt",
				desc: true,
			},
		],
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
		email,
		role: "member",
	});

	const link = await waitForLink(outbox, email, INVITED_NOTIFICATION);
	const page = await pageAs("admin");

	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/members/invitations",
		message("members_invitations_page_title"),
	);

	// The list is sorted newest first, so the invitation this test just
	// created is on the first page.
	const row = page.getByRole("row").filter({
		hasText: email,
	});
	await expect(row).toBeVisible();

	await row
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("members_invitations_table_delete_action"),
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

test("orgs: the invitations list carries every invitation of the active organisation", async ({
	api,
	org,
	pageAs,
}) => {
	test.slow();

	const mine = invitationEmail("mine");
	await inviteEmail(api.as("admin"), {
		email: mine,
		role: "member",
	});

	const theirs = invitationEmail("theirs");
	await inviteEmail(api.as("manager"), {
		email: theirs,
		role: "member",
	});

	const newestFirst = {
		pageIndex: 0,
		pageSize: 100,
		sort: [
			{
				id: "createdAt" as const,
				desc: true,
			},
		],
	};

	for (const role of [
		"admin",
		"manager",
	] as const) {
		const listed = await api.as(role).organizationInvitation.list(newestFirst);
		const emails = listed.data.map((invitation) => invitation.email);
		expect(emails).toContain(mine);
		expect(emails).toContain(theirs);
	}

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/members/invitations",
		message("members_invitations_page_title"),
	);

	// Both invitations are the newest of the organisation, so the first page
	// of the list settles the question.
	await expect(page.getByText(mine)).toBeVisible();
	await expect(page.getByText(theirs)).toBeVisible();
});

test("orgs: members and viewers are refused the invitations list", async ({
	api,
}) => {
	for (const role of [
		"member",
		"viewer",
	] as const) {
		await expectForbidden(
			api.as(role).organizationInvitation.list({
				pageIndex: 0,
				pageSize: 10,
			}),
		);
	}
});

test("orgs: the home People panel leaves the invitations out for a viewer", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("viewer");
	await enterApp(page, org.slug);
	await page
		.getByRole("tab", {
			name: message("home_view_manage_tab"),
		})
		.click();

	await expect(
		page.getByText(message("home_people_members_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(message("home_people_invitations_label"), {
			exact: true,
		}),
	).toHaveCount(0);
});

test("orgs: a manager is not offered to delete an admin invitation", async ({
	api,
	org,
	pageAs,
}) => {
	test.slow();

	const adminEmail = invitationEmail("ui-admin-role");
	await inviteEmail(api.as("admin"), {
		email: adminEmail,
		role: "admin",
	});
	const memberEmail = invitationEmail("ui-member-role");
	await inviteEmail(api.as("admin"), {
		email: memberEmail,
		role: "member",
	});

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/members/invitations",
		message("members_invitations_page_title"),
	);

	const rowOf = (email: string) =>
		page.getByRole("row").filter({
			hasText: email,
		});
	const copyLinkItem = page.getByRole("menuitem", {
		name: message("members_invitations_table_copy_link_action"),
	});
	const openRowMenu = async (email: string) => {
		await rowOf(email)
			.getByRole("button", {
				name: message("common_more_actions"),
			})
			.click();
		await expect(copyLinkItem).toBeVisible();
	};
	const closeRowMenu = async () => {
		await page.keyboard.press("Escape");
		await expect(copyLinkItem).toHaveCount(0);
	};
	const deleteItem = page.getByRole("menuitem", {
		name: message("members_invitations_table_delete_action"),
	});

	await openRowMenu(memberEmail);
	await expect(deleteItem).toBeVisible();
	await closeRowMenu();

	await openRowMenu(adminEmail);
	await expect(deleteItem).toHaveCount(0);
	await closeRowMenu();

	// An admin invitation cannot be selected, so selecting the page leaves
	// it out and bulk delete stays on offer for the rest.
	const selectBox = (email: string) =>
		rowOf(email).getByRole("checkbox", {
			name: message("data_table_select_row_label"),
		});
	await expect(selectBox(adminEmail)).toBeDisabled();
	await page
		.getByRole("checkbox", {
			name: message("data_table_select_all_rows_label"),
		})
		.click();
	await expect(selectBox(memberEmail)).toBeChecked();
	await expect(selectBox(adminEmail)).not.toBeChecked();
	await page
		.getByRole("button", {
			name: message("data_table_bulk_actions_trigger"),
		})
		.click();
	await expect(
		page.getByRole("menuitem", {
			name: message("common_delete_selected_action"),
		}),
	).toBeVisible();
});
