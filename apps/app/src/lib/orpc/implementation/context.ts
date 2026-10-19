import { withActiveSpan } from "@orcai/observability";
import { getCookie } from "@orpc/server/helpers";
import { secureCookiesFor } from "@/lib/authz/zed-token";
import { runtime } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";
import { COOKIES, HEADERS } from "@/settings/constants";
import { mapEffectErrors } from "./error-mapping";
import type { ORPCContext } from "./os";

const secureCookies = secureCookiesFor(loadAppConfigSync().auth.url);

/** The client's zedToken: the header from fetch clients, else the cookie from page loads. */
const readZedToken = (headers: Headers) =>
	headers.get(HEADERS.X_ZED_TOKEN) ||
	getCookie(headers, COOKIES.ZED_TOKEN.name);

export async function createORPCContext(params: {
	reqHeaders: Headers;
	zedToken?: string;
}): Promise<ORPCContext> {
	return {
		reqHeaders: params.reqHeaders,
		meta: {
			zedToken: params.zedToken ?? readZedToken(params.reqHeaders),
		},
		secureCookies,
		"effect/context": await runtime.context(),
		"effect/wrap": (effect) => mapEffectErrors(withActiveSpan(effect)),
	};
}
