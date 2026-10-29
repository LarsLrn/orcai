import { organizationIdSchema } from "@orcai/schema";
import { type ApiClient, createApiClient } from "../api";
import { activeOrganizationOf, type Session, signUpInvited } from "../auth";
import { untilAllowed } from "../authorization";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../constants";
import { runId } from "../organisation";

/** A user owned by the account slice.
 * Each spec changes the account it signs in with. */
export type AccountUser = {
	name: string;
	email: string;
	password: string;
	session: Session;
	/** Client acting as this user, for `user.me` and its own preferences. */
	api: ApiClient;
};

/** Create a user as a member of an organisation, by invitation and sign-up. */
export const createAccountUser = async (params: {
	baseURL: string;
	/** Goes into the address and the display name, so failures name the spec. */
	label: string;
	/** Client whose active organisation the user joins; it sends the invitation. */
	admin: ApiClient;
}): Promise<AccountUser> => {
	const name = `E2E Account ${params.label}`;
	const email = `account-${params.label}-${runId()}@${EMAIL_DOMAIN}`;

	const session = await signUpInvited({
		baseURL: params.baseURL,
		admin: params.admin,
		role: "member",
		name,
		email,
		password: USER_PASSWORD,
	});

	const api = createApiClient(params.baseURL, session.cookieHeader);

	// The sign-up hook grants the membership without a zedToken, so wait once
	// here for it to be readable; every later read of this user sees it.
	const organizationId = await activeOrganizationOf(params.baseURL, session);
	await untilAllowed(() =>
		api.organization.find({
			id: organizationIdSchema.parse(organizationId),
		}),
	);

	return {
		name,
		email,
		password: USER_PASSWORD,
		session,
		api,
	};
};

/** The name `user.me` reports, for asserting a profile change server side. */
export const nameOf = async (api: ApiClient): Promise<string> =>
	(await api.user.me({})).data.name;
