import {
	context,
	createContextKey,
	propagation,
	type Span,
	SpanKind,
	SpanStatusCode,
	type TextMapGetter,
	trace,
} from "@opentelemetry/api";
import { ATTR_ENDUSER_ID } from "@opentelemetry/semantic-conventions/incubating";
import type { AnyRouter } from "@tanstack/react-router";
import { whenSent } from "@/lib/server/open-requests";
import {
	loggablePath,
	normaliseHttpMethod,
	requestSpanName,
	resolveRequestRoute,
} from "./request-route";

const tracer = trace.getTracer("@orcai/app");
const requestSpanKey = createContextKey("@orcai/app/request-span");

/** Records the user a request runs as on its server span. */
export const recordRequestUser = (userId: string) => {
	const span = context.active().getValue(requestSpanKey);
	if (span) (span as Span).setAttribute(ATTR_ENDUSER_ID, userId);
};

const headersGetter: TextMapGetter<Headers> = {
	get: (headers, key) => headers.get(key) ?? undefined,
	keys: (headers) => [
		...headers.keys(),
	],
};

/** A client that disconnects cancels its request, which is no server failure. */
const failSpan = (span: Span, request: Request, error: unknown) => {
	if (request.signal.aborted) {
		span.addEvent("aborted");
		return;
	}
	span.recordException(error instanceof Error ? error : String(error));
	span.setStatus({
		code: SpanStatusCode.ERROR,
	});
};

/**
 * Runs the request handler inside a SERVER span that continues the caller's
 * W3C trace, so every span the request produces shares one trace.
 */
export const traceRequest = async (
	request: Request,
	router: Pick<AnyRouter, "getMatchedRoutes">,
	handle: () => Promise<Response>,
): Promise<Response> => {
	const { pathname } = new URL(request.url);
	const route = resolveRequestRoute(router, pathname);
	const path = loggablePath(route, pathname);
	const parent = propagation.extract(
		context.active(),
		request.headers,
		headersGetter,
	);
	const userAgent = request.headers.get("user-agent");
	const span = tracer.startSpan(
		requestSpanName(request.method, route),
		{
			kind: SpanKind.SERVER,
			attributes: {
				"http.request.method": normaliseHttpMethod(request.method),
				...(path && {
					"url.path": path,
				}),
				...(route && {
					"http.route": route,
				}),
				...(userAgent && {
					"user_agent.original": userAgent,
				}),
			},
		},
		parent,
	);

	let response: Response;
	try {
		response = await context.with(
			trace.setSpan(parent, span).setValue(requestSpanKey, span),
			handle,
		);
	} catch (error) {
		failSpan(span, request, error);
		span.end();
		throw error;
	}

	span.setAttribute("http.response.status_code", response.status);
	if (request.signal.aborted) {
		span.addEvent("aborted");
	} else if (response.status >= 500) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
		});
	}

	return whenSent(response, (failure) => {
		if (failure) failSpan(span, request, failure.error);
		span.end();
	});
};
