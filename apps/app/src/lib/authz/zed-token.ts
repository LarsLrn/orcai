import type { CookieOptions } from "better-auth";
import { COOKIES } from "@/settings/constants";

type ZedTokenContext = {
	meta?: {
		zedToken?: string;
	};
};

type ZedTokenInput = {
	zedToken?: string | undefined;
};

/** Explicit input token wins over the token carried by the request. */
export const getZedToken = (
	context: ZedTokenContext,
	input?: ZedTokenInput,
): string | undefined => input?.zedToken ?? context.meta?.zedToken;

/** Cookies are marked Secure only when the app is served over https. */
export const secureCookiesFor = (authUrl: string): boolean =>
	authUrl.startsWith("https://");

/** The attributes every response that hands out a zedToken uses. */
export const zedTokenCookieOptions = (secure: boolean) =>
	({
		maxAge: COOKIES.ZED_TOKEN.maxAge,
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure,
	}) satisfies CookieOptions;
