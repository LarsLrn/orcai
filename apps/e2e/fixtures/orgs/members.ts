import type { UserId } from "@orcai/core";
import type { ApiClient } from "../api";
import type { Role } from "../constants";

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
