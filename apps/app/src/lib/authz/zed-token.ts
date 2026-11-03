import { NEWEST_REVISION, type ReadRevision } from "@orcai/spice-db";
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
		/** The token the request carries. */
		zedToken?: string;
		/** The newest token of the assistant turn that makes the call. */
		turnZedToken?: string;
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** An empty token names no revision. */
const tokenOf = (value: unknown) =>
	typeof value === "string" && value !== "" ? value : undefined;

const inputTokenOf = (input: unknown) =>
	isRecord(input) ? tokenOf(input.zedToken) : undefined;

/** The token the request carries, to hand on to the calls it makes. */
export const requestZedToken = (context: ZedTokenContext): string | undefined =>
	tokenOf(context.meta?.zedToken);

/**
 * The revision a request's authorisation reads must see. The input's token,
 * the request's and a calling turn's may each be older than another, and
 * zedTokens cannot be compared, so different tokens read the newest
 * revision: the read sees every write any of them names and every revocation
 * any of them covers.
 */
export const readRevision = (
	context: ZedTokenContext,
	input?: unknown,
): ReadRevision | undefined => {
	const tokens = new Set(
		[
			inputTokenOf(input),
			requestZedToken(context),
			tokenOf(context.meta?.turnZedToken),
		].filter((token) => token !== undefined),
	);
	return tokens.size > 1 ? NEWEST_REVISION : tokens.values().next().value;
};

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

/** The newest token written by the authz writes of one request. */
class ZedTokenMailbox extends Context.Service<
	ZedTokenMailbox,
	{
		record: (zedToken: string, seq: number | undefined) => void;
	}
>()("ZedTokenMailbox") {}

/**
 * Records a written token for the request's response. No-op outside a request.
 * Concurrent writes of one request finish their deliveries in any order, so a
 * token with the seq of the outbox event that wrote it replaces only the token
 * of an older event. A token without one replaces any.
 */
export const recordZedToken = (zedToken: string | undefined, seq?: number) =>
	Effect.serviceOption(ZedTokenMailbox).pipe(
		Effect.flatMap((mailbox) =>
			Effect.sync(() => {
				if (zedToken && Option.isSome(mailbox))
					mailbox.value.record(zedToken, seq);
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
