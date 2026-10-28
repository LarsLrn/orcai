import type { WithEffectContext } from "@orpc/effect";
import { os } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import type { CookieOptions } from "better-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import { withName } from "@/lib/orpc/middlewares/utils";
import { COOKIES } from "@/settings/constants";

/**
 * The newest zedToken known for a request: the one it reads at, the one its
 * authz writes produced, and the one an assistant turn carries between its
 * procedure calls.
 */

type ZedTokenContext = {
	meta?: {
		zedToken?: string;
	};
};

type ZedTokenInput = {
	zedToken?: string | undefined;
};

/** The token a request reads at: explicit input wins over the token the request carries. */
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

/** The newest token written by the authz writes of one request; the last write wins. */
class ZedTokenMailbox extends Context.Service<
	ZedTokenMailbox,
	{
		record: (zedToken: string) => void;
	}
>()("ZedTokenMailbox") {}

/** Records a written token for the request's response. No-op outside a request. */
export const recordZedToken = (zedToken: string | undefined) =>
	Effect.serviceOption(ZedTokenMailbox).pipe(
		Effect.flatMap((mailbox) =>
			Effect.sync(() => {
				if (zedToken && Option.isSome(mailbox)) mailbox.value.record(zedToken);
			}),
		),
	);

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
			const result = await next({
				context: {
					"effect/context": Context.add(
						context["effect/context"],
						ZedTokenMailbox,
						{
							record: (written) => {
								zedToken = written;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const zedTokenOf = (output: unknown) =>
	isRecord(output) &&
	isRecord(output.meta) &&
	typeof output.meta.zedToken === "string"
		? output.meta.zedToken
		: undefined;

/** The newest zedToken of an assistant turn, so every call sees what earlier calls of the turn wrote. */
export interface TurnZedToken {
	readonly current: () => string | undefined;
	/**
	 * Runs `call` at the newest token and keeps the token its output carries.
	 * Calls run one at a time: concurrent writes could record an older token
	 * last, and zedTokens cannot be compared.
	 */
	readonly run: <A, E, R>(
		call: (zedToken: string | undefined) => Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
}

export const createTurnZedToken = (
	initial: string | undefined,
): TurnZedToken => {
	let latest = initial;
	const calls = Semaphore.makeUnsafe(1);

	return {
		current: () => latest,
		run: (call) =>
			Effect.suspend(() => call(latest)).pipe(
				Effect.tap((output) =>
					Effect.sync(() => {
						latest = zedTokenOf(output) ?? latest;
					}),
				),
				Semaphore.withPermit(calls),
			),
	};
};
