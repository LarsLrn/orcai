import type { WithEffectContext } from "@orpc/experimental-effect";
import { os } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import * as Context from "effect/Context";
import { zedTokenCookieOptions } from "@/lib/authz/zed-token";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import {
	createZedTokenMailbox,
	ZedTokenMailboxService,
} from "@/lib/effect/services/zed-token-mailbox";
import { withName } from "@/lib/orpc/middlewares/utils";
import { COOKIES } from "@/settings/constants";

interface ZedTokenResponseContext extends WithEffectContext<AppRuntimeContext> {
	resHeaders?: Headers | undefined;
	secureCookies?: boolean | undefined;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

/**
 * Publishes the zedToken written by the authz writes of this request: it merges
 * `meta.zedToken` into the output and refreshes the `zed_token` cookie, so no
 * handler carries the token itself. The mailbox lives for one request, is
 * written only by authz writes and read only here; reads keep using the token
 * the client sent.
 */
export const zedTokenResponseMiddleware = withName(
	os
		.$context<ZedTokenResponseContext>()
		.middleware(async ({ context, next }) => {
			const mailbox = createZedTokenMailbox();
			const result = await next({
				context: {
					"effect/context": Context.add(
						context["effect/context"],
						ZedTokenMailboxService,
						mailbox,
					),
				},
			});
			const zedToken = mailbox.read();

			if (!zedToken) return result;

			if (context.resHeaders)
				setCookie(
					context.resHeaders,
					COOKIES.ZED_TOKEN.name,
					zedToken,
					zedTokenCookieOptions(context.secureCookies === true),
				);

			if (!isPlainObject(result.output)) return result;

			const meta = result.output.meta;

			return {
				...result,
				output: {
					...result.output,
					meta: {
						...(isPlainObject(meta) ? meta : undefined),
						zedToken,
					},
				},
			};
		}),
	"zedTokenResponse",
);
