import type { UserId } from "@orcai/core";
import { type ApiClient, createApiClient, type ZedTokenStore } from "../api";
import type { Role } from "../constants";
import { baseURL } from "../env";
import type { FreshUser } from "../users";
import { inviteEmail } from "./invitations";

/** Add a user to the active organisation of `api`: invite the address, then accept as the user. */
export const addMember = async (
	api: ApiClient,
	membership: {
		user: FreshUser;
		role: Role;
		/** The test's zedToken memory, so its later reads see the acceptance. */
		zedTokens: ZedTokenStore;
	},
): Promise<void> => {
	const invitation = await inviteEmail(api, {
		email: membership.user.email,
		role: membership.role,
	});

	await createApiClient(
		baseURL(),
		membership.user.session.cookieHeader,
		membership.zedTokens,
	).organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
};

/** The role a user holds in the active organisation of `api`, as the members list reports it. */
export const memberRole = async (
	api: ApiClient,
	membership: {
		userId: UserId;
	},
): Promise<Role | undefined> => {
	const found = await api.organizationMember.find(membership);

	return found.data.organizationRole;
};
