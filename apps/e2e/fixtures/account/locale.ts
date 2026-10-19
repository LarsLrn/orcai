import type { Session } from "../auth";

type Locale = "en" | "de";

/** The language stored for a user, as its session reports it. */
export const storedLocaleOf = async (
	baseURL: string,
	session: Session,
): Promise<Locale | null> => {
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
		user?: {
			locale?: Locale | null;
		};
	} | null;

	return body?.user?.locale ?? null;
};

/** Store a language for a user, as the header switcher does when signed in. */
export const storeLocale = async (
	baseURL: string,
	session: Session,
	locale: Locale,
): Promise<void> => {
	const response = await fetch(`${baseURL}/api/auth/update-user`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: session.cookieHeader,
			// Better Auth rejects requests without a trusted origin.
			origin: baseURL,
		},
		body: JSON.stringify({
			locale,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Storing ${locale} for ${session.email} failed with ${String(response.status)}: ${await response.text()}`,
		);
	}
};
