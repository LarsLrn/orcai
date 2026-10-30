import type { OrganizationInvitation } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { EMAIL_DOMAIN, type Role } from "../constants";
import { submitForm } from "../forms";
import { message } from "../messages";
import { awaitHydration, open } from "../navigation";
import { runId } from "../organisation";

/** The outbox type the app queues for an invitation. */
export const INVITED_NOTIFICATION = "organization.invited";

/** An address nobody has used yet, so the invitee is always a new user. */
export const invitationEmail = (label: string): string =>
	`orgs-invite-${label}-${runId()}@${EMAIL_DOMAIN}`;

/** How long the app's own form gives an invitation. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Invite one address into the active organisation of `api` and return the invitation. */
export const inviteEmail = async (
	api: ApiClient,
	invitation: {
		email: string;
		role: Role;
	},
): Promise<OrganizationInvitation> => {
	const created = await api.organizationInvitation.create({
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
			name: message("auth_signup_form_submit_button"),
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
				.getByLabel(message("auth_signup_form_name_label"), {
					exact: true,
				})
				.fill(user.name);
			await page
				.getByLabel(message("auth_signup_form_password_label"), {
					exact: true,
				})
				.fill(user.password);
			await page
				.getByLabel(message("auth_signup_form_confirm_password_label"))
				.fill(user.password);

			const consent = page.getByRole("switch", {
				name: message("auth_signup_form_privacy_consent_label"),
			});
			await consent.check();
			await expect(consent).toBeChecked();
		},
		submit: message("auth_signup_form_submit_button"),
		until: user.until ?? /\/app(\/|$)/,
	});
};

/** Follow a link of the sign-in pages and wait for the page it opens. */
export const followAuthLink = async (
	page: Page,
	name: string,
	url: RegExp,
): Promise<void> => {
	const link = page.getByRole("link", {
		name,
	});
	await link.click();
	await expect(page).toHaveURL(url);
	// The URL moves before the old page unmounts, and the forgot-password page
	// has an Email field of its own. No target page repeats the link.
	await expect(link).toHaveCount(0);
	await awaitHydration(page);
};

/** Submit the sign-in form the page shows. */
export const submitSignIn = async (
	page: Page,
	user: {
		email: string;
		password: string;
		until: RegExp;
	},
): Promise<void> => {
	await submitForm(page, {
		fill: async () => {
			await page.getByLabel(message("common_email_label")).fill(user.email);
			await page
				.getByLabel(message("common_password_label"), {
					exact: true,
				})
				.fill(user.password);
		},
		submit: message("auth_signin_form_submit_button"),
		until: user.until,
	});
};

/** Open an invitation link signed out, follow its sign-in link and sign in. */
export const signInFromInvitation = async (
	page: Page,
	link: string,
	user: {
		email: string;
		password: string;
		until: RegExp;
	},
): Promise<void> => {
	await open(page, link);
	await followAuthLink(
		page,
		message("auth_register_page_signin_link"),
		/\/login\?inv=/,
	);
	await submitSignIn(page, user);
};

/** Accept the one pending invitation the selection page shows for `slug`. */
export const acceptOnSelectionPage = async (
	page: Page,
	slug: string,
): Promise<void> => {
	await expect(page).toHaveURL(/\/select-organization/);
	await expect(
		page.getByText(`@${slug}`, {
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: message("orgs_invitation_accept_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app(\/|$)/);
};

/** The role the active organisation's user list reports for an address. */
export const organisationRoleOf = async (
	api: ApiClient,
	email: string,
): Promise<Role | undefined> => {
	const users = await api.organizationMember.list({
		pageIndex: 0,
		pageSize: 100,
	});

	return users.data.find((user) => user.email === email)?.organizationRole;
};
