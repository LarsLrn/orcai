import type { UserId } from "@orcai/core";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { type ApiClient, createApiClient, type ZedTokenStore } from "./api";
import {
	activeOrganizationOf,
	inviteEmail,
	type Session,
	signUpInvited,
} from "./auth";
import { untilAllowed } from "./authorization";
import { EMAIL_DOMAIN, type Role, USER_PASSWORD } from "./constants";
import { baseURL } from "./env";
import { runId, signUpUnaffiliated } from "./organisation";

/** A user of one test, free to change, ban, or remove. */
export type FreshUser = {
	id: UserId;
	name: string;
	email: string;
	password: string;
	session: Session;
};

/** `label` goes into the address and the display name, so failures name the spec. */
const identity = (label: string) => {
	const suffix = runId();

	return {
		name: `E2E ${label} ${suffix}`,
		email: `e2e-${label}-${suffix}@${EMAIL_DOMAIN}`,
		password: USER_PASSWORD,
	};
};

/** A fresh user that belongs to no organisation. */
export const createUser = async (label: string): Promise<FreshUser> => {
	const user = identity(label);
	const session = await signUpUnaffiliated({
		baseURL: baseURL(),
		...user,
	});

	return {
		id: userIdSchema.parse(session.userId),
		...user,
		session,
	};
};

/** A fresh member of the active organisation of `admin`, by invitation and sign-up. */
export const createMember = async (params: {
	label: string;
	/** Sends the invitation. */
	admin: ApiClient;
	initialTour?: "skipped" | "unseen";
}): Promise<
	FreshUser & {
		/** Client acting as this user. */
		api: ApiClient;
	}
> => {
	const user = identity(params.label);
	const session = await signUpInvited({
		baseURL: baseURL(),
		admin: params.admin,
		role: "member",
		...user,
		initialTour: params.initialTour,
	});
	const api = createApiClient(baseURL(), session.cookieHeader);

	// The sign-up hook grants the membership without a zedToken, so wait once
	// here for it to be readable; every later read of this user sees it.
	const organizationId = await activeOrganizationOf(baseURL(), session);
	await untilAllowed(() =>
		api.organization.find({
			id: organizationIdSchema.parse(organizationId),
		}),
	);

	return {
		id: userIdSchema.parse(session.userId),
		...user,
		session,
		api,
	};
};

/**
 * Add an existing user to the active organisation of `admin`: invite the
 * address, then accept as the user. The acceptance goes through `zedTokens`,
 * so the test's later reads and pages see the membership.
 */
export const addMember = async (
	admin: ApiClient,
	membership: {
		user: FreshUser;
		role: Role;
		zedTokens: ZedTokenStore;
	},
): Promise<void> => {
	const { id } = await inviteEmail(admin, {
		email: membership.user.email,
		role: membership.role,
	});

	await createApiClient(
		baseURL(),
		membership.user.session.cookieHeader,
		membership.zedTokens,
	).organizationInvitation.respond({
		id,
		response: "accept",
	});
};
