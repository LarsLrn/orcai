import { trace } from "@opentelemetry/api";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
	GetMethodCsrfProtectionHandlerPlugin,
	RequestHeadersHandlerPlugin,
	ResponseCompressionHandlerPlugin,
	ResponseHeadersHandlerPlugin,
} from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";
import { createORPCContext } from "@/lib/orpc/implementation/context";
import { logFailedProcedure } from "@/lib/orpc/implementation/interceptors";
import { toFetchResponse } from "@/lib/orpc/implementation/response";
import {
	describeValidationFailure,
	errorStatusMap,
} from "@/lib/orpc/implementation/validation";
import { router } from "@/lib/orpc/router";

const handler = new RPCHandler(router, {
	clientInterceptors: [
		onError(describeValidationFailure),
		onError(logFailedProcedure),
	],
	interceptors: [
		({ request, next }) => {
			const span = trace.getActiveSpan();

			request.signal?.addEventListener("abort", () => {
				span?.addEvent("aborted", {
					reason: String(request.signal?.reason),
				});
			});

			return next();
		},
	],
	plugins: [
		new RequestHeadersHandlerPlugin(),
		new ResponseHeadersHandlerPlugin(),
		new ResponseCompressionHandlerPlugin(),
		new GetMethodCsrfProtectionHandlerPlugin(),
	],
	errorStatusMap,
	toFetchResponse,
});

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const { response } = await handler.handle(request, {
					prefix: "/api/rpc",
					context: await createORPCContext({
						reqHeaders: request.headers,
					}),
				});

				return (
					response ??
					new Response("Not Found", {
						status: 404,
					})
				);
			},
		},
	},
});
