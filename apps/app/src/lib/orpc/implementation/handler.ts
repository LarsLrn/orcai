import { trace } from "@opentelemetry/api";
import { onError } from "@orpc/server";
import {
	RequestHeadersHandlerPlugin,
	ResponseHeadersHandlerPlugin,
} from "@orpc/server/plugins";
import type { StandardHandlerOptions } from "@orpc/server/standard";
import { createORPCContext } from "./context";
import { logFailedProcedure } from "./interceptors";
import type { ORPCContext } from "./os";
import { toFetchResponse } from "./response";
import { describeValidationFailure, errorStatusMap } from "./validation";

/** What the RPC and the OpenAPI handler share; each appends its own plugins. */
export const sharedHandlerOptions = () => {
	const options = {
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
		],
	} satisfies StandardHandlerOptions<ORPCContext>;

	return {
		...options,
		errorStatusMap,
		toFetchResponse,
	};
};

/** A route's ANY handler that serves `handler` under `prefix`. */
export const serveUnder =
	(
		handler: {
			handle(
				request: Request,
				options: {
					prefix: `/${string}`;
					context: ORPCContext;
				},
			): Promise<{
				response?: Response;
			}>;
		},
		prefix: `/${string}`,
	) =>
	async ({ request }: { request: Request }) => {
		const { response } = await handler.handle(request, {
			prefix,
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
	};
