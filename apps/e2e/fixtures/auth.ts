import type { OrganizationId, OrganizationInvitationId } from "@orcai/core";
import type { BrowserContextOptions } from "@playwright/test";
import type { ApiClient } from "./api";
import { untilAllowed } from "./authorization";
import { type Role, USER_PASSWORD } from "./constants";

export type StorageState = Exclude<
	NonNullable<BrowserContextOptions["storageState"]>,
	string
>;

export type Session = {
	userId: string;
	email: string;
	/** Value for a `cookie` request header, for API calls. */
	cookieHeader: string;
	/** Playwright storage state, for `browser.newContext`. */
	storageState: StorageState;
};

type SetCookie = {
	name: string;
	value: string;
	path: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: "Strict" | "Lax" | "None";
};

const parseSetCookie = (header: string): SetCookie | undefined => {
	const [pair, ...attributes] = header.split(";");
	const separator = pair.indexOf("=");

	if (separator < 1) {
		return undefined;
	}

	const cookie: SetCookie = {
		name: pair.slice(0, separator).trim(),
		value: pair.slice(separator + 1).trim(),
		path: "/",
		httpOnly: false,
		secure: false,
		sameSite: "Lax",
	};

	for (const attribute of attributes) {
		const [rawKey, rawValue = ""] = attribute.split("=");
		const key = rawKey.trim().toLowerCase();

		if (key === "path") {
			cookie.path = rawValue.trim() || "/";
		} else if (key === "httponly") {
			cookie.httpOnly = true;
		} else if (key === "secure") {
			cookie.secure = true;
		} else if (key === "samesite") {
			const value = rawValue.trim().toLowerCase();
			cookie.sameSite =
				value === "strict" ? "Strict" : value === "none" ? "None" : "Lax";
		}
	}

	return cookie;
};

const toStorageState = (
	baseURL: string,
	cookies: readonly SetCookie[],
): StorageState => {
	const domain = new URL(baseURL).hostname;
	const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

	return {
		cookies: cookies.map((cookie) => ({
			...cookie,
			domain,
			expires,
		})),
		origins: [],
	};
};

const toCookieHeader = (cookies: readonly SetCookie[]) =>
	cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

const readSession = async (
	baseURL: string,
	response: Response,
): Promise<Session> => {
	const body = (await response.json()) as {
		user?: {
			id?: string;
			email?: string;
		};
	};

	if (!body.user?.id || !body.user.email) {
		throw new Error(
			`Better Auth response did not contain a user: ${JSON.stringify(body)}`,
		);
	}

	const cookies = response.headers
		.getSetCookie()
		.map(parseSetCookie)
		.filter((cookie): cookie is SetCookie => cookie !== undefined);

	if (cookies.length === 0) {
		throw new Error(
			`Better Auth response for ${body.user.email} did not set a session cookie.`,
		);
	}

	return {
		userId: body.user.id,
		email: body.user.email,
		cookieHeader: toCookieHeader(cookies),
		storageState: toStorageState(baseURL, cookies),
	};
};

const post = async (baseURL: string, path: string, payload: unknown) => {
	const response = await fetch(`${baseURL}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			// Better Auth rejects requests without a trusted origin.
			origin: baseURL,
		},
		body: JSON.stringify(payload),
		redirect: "manual",
	});

	if (!response.ok) {
		throw new Error(
			`POST ${path} failed with ${String(response.status)}: ${await response.text()}`,
		);
	}

	return response;
};

/** The raw answer of the sign-up endpoint, only for asserting that a sign-up is refused. */
export const attemptSignUp = async (
	baseURL: string,
	user: {
		name: string;
		email: string;
		password: string;
		invitationId?: OrganizationInvitationId;
	},
): Promise<Response> =>
	await fetch(`${baseURL}/api/auth/sign-up/email`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			// Better Auth rejects requests without a trusted origin.
			origin: baseURL,
		},
		body: JSON.stringify(user),
		redirect: "manual",
	});

/** How long a fixture invitation lives, matching the app's own form. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Invite an address as `admin`, then sign it up. The user comes back a member
 * with the invited role and, if this is its only organisation, inside it.
 */
export const signUpInvited = async (params: {
	baseURL: string;
	admin: ApiClient;
	organisation: {
		id: OrganizationId;
	};
	role: Role;
	name: string;
	email: string;
	password?: string;
}): Promise<
	Session & {
		invitationId: OrganizationInvitationId;
	}
> => {
	const password = params.password ?? USER_PASSWORD;
	const created = await untilAllowed(() =>
		params.admin.organizationInvitation.create({
			organizationId: params.organisation.id,
			role: params.role,
			expiresAt: new Date(Date.now() + ONE_WEEK),
			items: [
				{
					email: params.email,
				},
			],
		}),
	);

	const response = await attemptSignUp(params.baseURL, {
		invitationId: created.data[0].id,
		name: params.name,
		email: params.email,
		password,
	});

	if (!response.ok) {
		throw new Error(
			`Sign-up for the invited address ${params.email} failed with ${String(response.status)}: ${await response.text()}`,
		);
	}

	const session = await readSession(params.baseURL, response);

	return {
		...session,
		invitationId: created.data[0].id,
	};
};

/** The active organisation the app reports for a session. */
export const activeOrganizationOf = async (
	baseURL: string,
	session: Session,
): Promise<string | null> => {
	const response = await fetch(`${baseURL}/api/auth/get-session`, {
		headers: {
			cookie: session.cookieHeader,
			origin: baseURL,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Reading the session of ${session.email} failed with ${String(response.status)}`,
		);
	}

	const body = (await response.json()) as {
		session?: {
			activeOrganizationId?: string | null;
		};
	} | null;

	return body?.session?.activeOrganizationId ?? null;
};

/** Sign in an existing user and capture its session cookie. */
export const signIn = async (
	baseURL: string,
	credentials: {
		email: string;
		password: string;
	},
): Promise<Session> =>
	readSession(
		baseURL,
		await post(baseURL, "/api/auth/sign-in/email", credentials),
	);
