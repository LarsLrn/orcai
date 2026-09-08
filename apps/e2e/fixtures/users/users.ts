import type { OrganizationRole, UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createApiClient, ZED_TOKEN_COOKIE, type ZedTokenStore } from "../api";
import type { Session } from "../auth";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../constants";
import { baseURL } from "../env";
import type { Api } from "../index";
import type { WorkerOrganisation } from "../organisation";
import { runId, signUpUnaffiliated } from "../organisation";

/** A user owned by the users slice.
 * Bans, demotions, and removals stay within its worker data. */
export type ThrowawayUser = {
	id: UserId;
	name: string;
	email: string;
	password: string;
	session: Session;
};

/** Create a user that belongs to no organisation yet. */
export const createThrowawayUser = async (
	baseURL: string,
	label: string,
): Promise<ThrowawayUser> => {
	const suffix = runId();
	const name = `E2E Users ${label} ${suffix}`;
	const email = `e2e-users-${label}-${suffix}@${EMAIL_DOMAIN}`;

	const session = await signUpUnaffiliated({
		baseURL,
		name,
		email,
		password: USER_PASSWORD,
	});

	return {
		id: userIdSchema.parse(session.userId),
		name,
		email,
		password: USER_PASSWORD,
		session,
	};
};

/** A template block, the one grantable resource that needs no model, provider, or worker. */
export const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the users slice.",
	},
});

/** How long a fixture invitation lives, matching the app's own form. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Add a throwaway user to a worker organisation: invite the address, then accept as the user.
 * Pass the test's `zedTokens` so the acceptance revision reaches its other clients and pages. */
export const addMember = async (
	api: Api,
	organisation: WorkerOrganisation,
	user: ThrowawayUser,
	role: OrganizationRole = "member",
	zedTokens?: ZedTokenStore,
): Promise<void> => {
	const invited = await api
		.as("admin", organisation)
		.organizationInvitation.create({
			organizationId: organisation.id,
			role,
			expiresAt: new Date(Date.now() + ONE_WEEK),
			items: [
				{
					email: user.email,
				},
			],
		});

	await createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	).organizationInvitation.respond({
		id: invited.data[0].id,
		response: "accept",
	});
};

/** Carry the newest revision a page has been given back to the test's API clients. */
export const adoptZedToken = async (
	page: Page,
	zedTokens: ZedTokenStore,
): Promise<void> => {
	const cookie = (await page.context().cookies()).find(
		(entry) => entry.name === ZED_TOKEN_COOKIE,
	);

	if (cookie) zedTokens.write(cookie.value);
};

/** Open a page behind the `manage_members` guard. */
export const reachPage = async (
	page: Page,
	path: string,
	heading: string,
): Promise<void> => {
	await page.goto(path);
	await expect(
		page.getByRole("heading", {
			name: heading,
		}),
	).toBeVisible();
};

/** The row of the users table that belongs to an email address. */
export const userRow = (page: Page, email: string): Locator =>
	page.getByRole("row").filter({
		hasText: email,
	});

/** The entries of the row action menu for a user. */
export const rowMenuItems = async (
	page: Page,
	email: string,
): Promise<string[]> => {
	await userRow(page, email)
		.getByRole("button", {
			name: "Open menu",
		})
		.click();

	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();

	return await menu.getByRole("menuitem").allInnerTexts();
};

/** Pick a role in the edit page's role picker, whose trigger is named after the current role. */
export const chooseRole = async (
	page: Page,
	from: string,
	to: string,
): Promise<void> => {
	await page
		.getByRole("button", {
			name: from,
			exact: true,
		})
		.click();
	await page
		.getByRole("option", {
			name: new RegExp(`^${to}`),
		})
		.click();
};
