import { randomBytes } from "node:crypto";
import type { Session } from "../auth";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../constants";
import { signUpUnaffiliated } from "../organisation";

/** A user owned by the auth slice.
 * Password reset and sign-out break a shared user. */
export type AuthUser = {
	name: string;
	email: string;
	password: string;
	session: Session;
};

/** Create a fresh user with no organisation. */
export const createAuthUser = async (
	baseURL: string,
	label: string,
): Promise<AuthUser> => {
	const name = `E2E Auth ${label}`;
	const email = `auth-${label}-${randomBytes(3).toString("hex")}@${EMAIL_DOMAIN}`;

	const session = await signUpUnaffiliated({
		baseURL,
		name,
		email,
		password: USER_PASSWORD,
	});

	return {
		name,
		email,
		password: USER_PASSWORD,
		session,
	};
};
