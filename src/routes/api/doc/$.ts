import { trace } from "@opentelemetry/api";
import { LoggingHandlerPlugin } from "@orpc/experimental-pino";
import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import {
	BatchHandlerPlugin,
	RequestHeadersPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createFileRoute } from "@tanstack/react-router";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import { logger } from "@/lib/observability/logger";
import { router } from "@/lib/orpc/router";
import { COOKIES, HEADERS } from "@/settings/constants";

const openAPIGenerator = new OpenAPIGenerator({
	schemaConverters: [
		new ZodToJsonSchemaConverter(),
	],
});

const specFromRouter = await openAPIGenerator.generate(router, {
	info: {
		title: "SokratesT API Documentation",
		version: "1.0.0",
	},
	security: [
		{
			bearerAuth: [],
			zedToken: [],
		},
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
			},
			zedToken: {
				type: "apiKey",
				in: "header",
				name: HEADERS.X_ZED_TOKEN,
				description:
					"ZedToken for SpiceDB consistency. Optional and not a secret.",
			},
		},
	},
});

const openAPIHandler = new OpenAPIHandler(router, {
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
		/**
		 * Restricts GET methods to only use GET requests:
		 * https://orpc.unnoq.com/docs/plugins/strict-get-method
		 */
		new StrictGetMethodPlugin(),
		/**
		 * TODO: Uncomment this when CSRF protection is needed
		 * Adds CSRF protection to the handler:
		 * https://orpc.unnoq.com/docs/plugins/simple-csrf-protection
		 */
		/* new SimpleCsrfProtectionHandlerPlugin(), */
		new SmartCoercionPlugin({
			schemaConverters: [
				new ZodToJsonSchemaConverter(),
			],
		}),
		new OpenAPIReferencePlugin({
			schemaConverters: [
				new ZodToJsonSchemaConverter(),
			],
			specGenerateOptions: specFromRouter,
			docsConfig: {
				authentication: {
					securitySchemes: {
						bearerAuth: {
							token: "default-token",
						},
						zedToken: {
							token: "some-zed-token",
						},
					},
				},
			},
		}),
		new LoggingHandlerPlugin({
			logger,
			generateId: () => uuidv4(),
		}),
	],
});

export const Route = createFileRoute("/api/doc/$")({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				// 1. Try explicit header (from Client Fetch)
				let zedToken = request.headers.get(HEADERS.X_ZED_TOKEN) || undefined;

				// 2. Fallback to Cookie (from SSR/Loader calls)
				if (!zedToken) {
					zedToken = getCookie(request.headers, COOKIES.ZED_TOKEN.name);
				}

				const { response } = await openAPIHandler.handle(request, {
					prefix: "/api/doc",
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
