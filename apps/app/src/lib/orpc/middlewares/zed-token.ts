import type { WithEffectContext } from "@orpc/effect";
import { os } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import * as Context from "effect/Context";
import { ZedTokenMailbox, zedTokenCookieOptions } from "@/lib/authz/zed-token";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
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
 * Publishes the token the request's authz writes recorded: it merges
 * `meta.zedToken` into the output and refreshes the `zed_token` cookie, so no
 * handler carries the token itself. Reads keep using the token the client sent.
 */
export const zedTokenResponseMiddleware = withName(
	os
		.$context<ZedTokenResponseContext>()
		.middleware(async ({ context, next }) => {
			let zedToken: string | undefined;
			let newestSeq: number | undefined;
			const result = await next({
				context: {
					"effect/context": Context.add(
						context["effect/context"],
						ZedTokenMailbox,
						{
							record: (written, seq) => {
								if (
									seq !== undefined &&
									newestSeq !== undefined &&
									seq < newestSeq
								)
									return;
								zedToken = written;
								newestSeq = seq;
							},
						},
					),
				},
			});

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
