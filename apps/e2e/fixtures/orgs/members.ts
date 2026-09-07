import type { OrganizationId, UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import { type ApiClient, createApiClient } from "../api";
import type { Session } from "../auth";
import { untilAllowed } from "../authorization";
import { EMAIL_DOMAIN, type Role, USER_PASSWORD } from "../constants";
import { baseURL } from "../env";
import { runId, signUpUnaffiliated } from "../organisation";
import { inviteEmail } from "./invitations";

/** A user owned by the orgs slice.
 * Role changes and removals stay within its worker data. */
export type OrgsUser = {
	id: UserId;
	name: string;
	email: string;
	password: string;
	session: Session;
};

/** Create a fresh user that belongs to no organisation yet. */
export const createOrgsUser = async (
	baseURL: string,
	label: string,
): Promise<OrgsUser> => {
	const name = `E2E Orgs ${label}`;
	const email = `orgs-${label}-${runId()}@${EMAIL_DOMAIN}`;

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

/** Add a user to an organisation: invite the address, then accept as the user. */
export const addMember = async (
	api: ApiClient,
	membership: {
		organizationId: OrganizationId;
		user: OrgsUser;
		role: Role;
	},
): Promise<void> => {
	const invitation = await inviteEmail(api, {
		organizationId: membership.organizationId,
		email: membership.user.email,
		role: membership.role,
	});

	await createApiClient(
		baseURL(),
		membership.user.session.cookieHeader,
	).organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
};

/** The role a user holds in an organisation, as the members list reports it. */
export const memberRole = async (
	api: ApiClient,
	membership: {
		organizationId: OrganizationId;
		userId: UserId;
	},
): Promise<Role | undefined> => {
	const found = await untilAllowed(() =>
		api.organizationMember.find(membership),
	);

	return found.data.role;
};
