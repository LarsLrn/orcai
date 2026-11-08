import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { inviteEmail } from "../../fixtures/auth";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { createMember } from "../../fixtures/users";

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

	await inviteEmail(api.as("admin", second), {
		email: user.email,
		role: "member",
	});

	const page = await pageForSession(user.session);

	await openAccountPage(page, "invitations");

	const invitations = accountCard(
		page,
		message("account_invitations_card_title"),
	);

	const entry = invitations.getByRole("group", {
		name: second.name,
		exact: true,
	});

	await expect(entry).toBeVisible();
	await expect(
		entry.getByText(`@${second.slug}`, {
			exact: true,
		}),
	).toBeVisible();
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

	await inviteEmail(api.as("admin", second), {
		email: user.email,
		role: "member",
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
