import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { context as otelContext, trace } from "@opentelemetry/api";
import { logErrorCause } from "@orcai/observability";
import { getCookie } from "@orpc/server/helpers";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { secureCookiesFor } from "@/lib/authz/zed-token";
import { runtime } from "@/lib/effect/runtime";
import { loadAppConfigSync } from "@/lib/effect/services/config";
import { COOKIES, HEADERS } from "@/settings/constants";
import { causeToORPCError } from "./error-mapping";
import type { ORPCContext } from "./os";

function mapEffectCauseToORPCError<A, E>(
	effect: Effect.Effect<A, E>,
): Effect.Effect<A, E> {
	const mapped = (effect as Effect.Effect<A, unknown>).pipe(
		Effect.catchCause((cause: Cause.Cause<unknown>) => {
			if (Cause.hasInterruptsOnly(cause)) {
				return Effect.failCause(cause);
			}

			return logErrorCause("ORPC effect failed", cause).pipe(
				Effect.andThen(Effect.fail(causeToORPCError(cause))),
			);
		}),
	);

	return mapped as unknown as Effect.Effect<A, E>;
}

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
		"effect/wrap": (effect) => {
			const activeSpan = trace.getSpan(otelContext.active());

			const traced = activeSpan
				? OtelTracer.withSpanContext(effect, activeSpan.spanContext())
				: effect;

			return mapEffectCauseToORPCError(traced);
		},
	};
}
