import { trace } from "@opentelemetry/api";
import { LoggingHandlerPlugin } from "@orpc/experimental-pino";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import { CompressionPlugin, RPCHandler } from "@orpc/server/fetch";
import { getCookie } from "@orpc/server/helpers";
import {
	BatchHandlerPlugin,
	RequestHeadersPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { logger } from "@/lib/observability/logger";
import { router } from "@/lib/orpc/router";
import { COOKIES, HEADERS } from "@/settings/constants";

const handler = new RPCHandler(router, {
	clientInterceptors: [
		onError((error) => {
			if (
				error instanceof ORPCError &&
				error.code === "BAD_REQUEST" &&
				error.cause instanceof ValidationError
			) {
				const zodError = new z.ZodError(
					error.cause.issues as z.core.$ZodIssue[],
				);

				throw new ORPCError("INPUT_VALIDATION_FAILED", {
					status: 422,
					message: z.prettifyError(zodError),
					data: z.flattenError(zodError),
					cause: error.cause,
				});
			}

			if (
				error instanceof ORPCError &&
				error.code === "INTERNAL_SERVER_ERROR" &&
				error.cause instanceof ValidationError
			) {
				const zodError = new z.ZodError(
					error.cause.issues as z.core.$ZodIssue[],
				);

				throw new ORPCError("OUTPUT_VALIDATION_FAILED", {
					status: 422,
					message: z.prettifyError(zodError),
					data: z.flattenError(zodError),
					cause: error.cause,
				});
			}
		}),
	],
	interceptors: [
		onError((error) => {
			logger.error(error);
		}),
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
		new RequestHeadersPlugin(),
		new BatchHandlerPlugin(),
		new StrictGetMethodPlugin(),
		new CompressionPlugin(),
		new LoggingHandlerPlugin({
			logger,
			generateId: () => uuidv4(),
		}),
	],
});

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				// 1. Try explicit header (from Client Fetch)
				let zedToken = request.headers.get(HEADERS.X_ZED_TOKEN) || undefined;

				// 2. Fallback to Cookie (from SSR/Loader calls)
				if (!zedToken) {
					zedToken = getCookie(request.headers, COOKIES.ZED_TOKEN.name);
				}

				const { response } = await handler.handle(request, {
					prefix: "/api/rpc",
					context: {
						reqHeaders: request.headers,
						meta: {
							zedToken,
						},
					},
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
