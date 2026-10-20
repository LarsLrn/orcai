import type { OrganizationRole } from "@orcai/core";
import {
	type CreateOrganizationInvitationsInput,
	DEFAULT_INVITATION_TTL_DAYS,
	type Locale,
	localeSchema,
} from "@orcai/schema";
import { cookieName, extractLocaleFromHeader } from "@/paraglide/runtime";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The locale the caller's UI runs in, as the invite form sends it: the locale
 * cookie, else Accept-Language. Read from the procedure context's headers, as
 * async-local request state is not reliable inside Effect fibers. Undefined
 * leaves the procedure's fallback, the caller's stored locale.
 */
export const requestLocale = (
	headers: Headers | undefined,
): Locale | undefined => {
	if (!headers) {
		return undefined;
	}

	const cookie = headers
		.get("cookie")
		?.split(";")
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${cookieName}=`))
		?.slice(cookieName.length + 1);
	const fromCookie = localeSchema.safeParse(cookie);

	return fromCookie.success
		? fromCookie.data
		: extractLocaleFromHeader(
				new Request("http://localhost/", {
					headers,
				}),
			);
};

/** The invite form's defaults: expiry a week out, one item per address, duplicates dropped. */
export const invitationInput = (
	{
		emails,
		role,
	}: {
		emails: string[];
		role: OrganizationRole;
	},
	{
		now,
		locale,
	}: {
		now: Date;
		locale: Locale | undefined;
	},
): CreateOrganizationInvitationsInput => {
	const byAddress = new Map(
		emails.map((email) => [
			email.trim().toLowerCase(),
			email.trim(),
		]),
	);

	return {
		role,
		expiresAt: new Date(now.getTime() + DEFAULT_INVITATION_TTL_DAYS * DAY_MS),
		locale,
		items: [
			...byAddress.values(),
		].map((email) => ({
			email,
		})),
	};
};
