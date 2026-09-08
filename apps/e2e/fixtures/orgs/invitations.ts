import type { OrganizationId } from "@orcai/core";
import type { OrganizationInvitation } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { EMAIL_DOMAIN, type Role } from "../constants";
import { submitForm } from "../forms";
import { open } from "../navigation";
import { runId } from "../organisation";

/** The outbox type the app queues for an invitation. */
export const INVITED_NOTIFICATION = "organization.invited";

/** An address nobody has used yet, so the invitee is always a new user. */
export const invitationEmail = (label: string): string =>
	`orgs-invite-${label}-${runId()}@${EMAIL_DOMAIN}`;

/** How long the app's own form gives an invitation. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Invite one address over the API and return the invitation. */
export const inviteEmail = async (
	api: ApiClient,
	invitation: {
		organizationId: OrganizationId;
		email: string;
		role: Role;
	},
): Promise<OrganizationInvitation> => {
	const created = await api.organizationInvitation.create({
		organizationId: invitation.organizationId,
		role: invitation.role,
		expiresAt: new Date(Date.now() + ONE_WEEK),
		items: [
			{
				email: invitation.email,
			},
		],
	});

	return created.data[0];
};

/** Fill the sign-up form an invitation link opens; email and code come prefilled. */
export const registerFromInvitation = async (
	page: Page,
	link: string,
	user: {
		name: string;
		password: string;
		/** Asserted in the card description before the form is submitted. */
		organisationName?: string;
		until?: RegExp;
	},
): Promise<void> => {
	await open(page, link);

	await expect(
		page.getByRole("button", {
			name: "Register",
		}),
	).toBeVisible();

	if (user.organisationName) {
		await expect(
			page.getByText(`${user.organisationName} invited you.`, {
				exact: false,
			}),
		).toBeVisible();
	}

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel("Name", {
					exact: true,
				})
				.fill(user.name);
			await page
				.getByLabel("Password", {
					exact: true,
				})
				.fill(user.password);
			await page.getByLabel("Confirm Password").fill(user.password);

			const consent = page.getByRole("switch", {
				name: "Privacy Consent",
			});
			await consent.check();
			await expect(consent).toBeChecked();
		},
		submit: "Register",
		until: user.until ?? /\/en\/app(\/|$)/,
	});
};

/** The role the active organisation's user list reports for an address. */
export const organisationRoleOf = async (
	api: ApiClient,
	email: string,
): Promise<Role | undefined> => {
	const users = await api.user.list({
		pageIndex: 0,
		pageSize: 100,
	});

	return users.data.find((user) => user.email === email)?.organizationRole;
};
