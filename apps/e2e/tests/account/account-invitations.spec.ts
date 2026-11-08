import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { createMember } from "../../fixtures/users";

/** How long the app's own invitation form gives an invitation. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

test("account: the invitations card shows a pending invitation and accepting it adds the membership", async ({
	api,
	orgs,
	pageForSession,
}) => {
	const user = await createMember({
		label: "invite",
		admin: api.as("admin"),
	});

	// The invitation has to come from an organisation the user is not in yet.
	const second = await orgs.create("Account Invitations");

	await api.as("admin", second).organizationInvitation.create({
		role: "member",
		expiresAt: new Date(Date.now() + ONE_WEEK),
		items: [
			{
				email: user.email,
			},
		],
	});

	const page = await pageForSession(user.session);

	await openAccountPage(page, "invitations");

	const invitations = accountCard(
		page,
		message("account_invitations_card_title"),
	);

	// The list carries the organisation's name and slug, so the invitee
	// can tell the entries apart without reading the organisation.
	const entry = invitations
		.getByText(`@${second.slug}`, {
			exact: true,
		})
		.locator('xpath=ancestor::div[@data-slot="card"][1]');

	await expect(entry).toBeVisible();
	await expect(
		entry.getByText(message("orgs_invitation_status_pending")),
	).toBeVisible();

	await entry
		.getByRole("button", {
			name: message("orgs_invitation_accept_button"),
		})
		.click();
	await expect(
		page.getByText(message("orgs_invitation_accept_toast_success")),
	).toBeVisible();

	// Accepting writes the membership, which the user's own organisation
	// list reports from the database.
	const organisations = await user.api.organization.list({
		pageIndex: 0,
		pageSize: 100,
	});

	expect(organisations.data.map((organisation) => organisation.slug)).toContain(
		second.slug,
	);
});

test("account: the invitations card names the inviting organisation", async ({
	api,
	orgs,
	pageForSession,
}) => {
	const user = await createMember({
		label: "invite-name",
		admin: api.as("admin"),
	});
	const second = await orgs.create("Account Invitation Name");

	await api.as("admin", second).organizationInvitation.create({
		role: "member",
		expiresAt: new Date(Date.now() + ONE_WEEK),
		items: [
			{
				email: user.email,
			},
		],
	});

	const page = await pageForSession(user.session);

	await openAccountPage(page, "invitations");

	const invitations = accountCard(
		page,
		message("account_invitations_card_title"),
	);

	await expect(
		invitations.getByText(second.name, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		invitations.getByText(`@${second.slug}`, {
			exact: true,
		}),
	).toBeVisible();
});
