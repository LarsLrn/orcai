import { trace } from "@opentelemetry/api";
import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import {
	BatchHandlerPlugin,
	RequestHeadersHandlerPlugin,
} from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { router } from "@/lib/orpc/router";
import { COOKIES, HEADERS } from "@/settings/constants";

const openAPIGenerator = new OpenAPIGenerator({
	converters: [
		new ZodToJsonSchemaConverter(),
	],
});

const specFromRouter = await openAPIGenerator.generate(router, {
	base: {
		info: {
			title: "OrcAI API Documentation",
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
					message: z.prettifyError(zodError),
					data: z.flattenError(zodError),
					cause: error.cause,
				});
			}
		}),
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
		new BatchHandlerPlugin(),
		/**
		 * TODO: Uncomment this when CSRF protection is needed
		 * Adds CSRF protection to the handler:
		 * https://orpc.unnoq.com/docs/plugins/simple-csrf-protection
		 */
		/* new SimpleCsrfProtectionHandlerPlugin(), */
		new SmartCoercionHandlerPlugin({
			converters: [
				new ZodToJsonSchemaConverter(),
			],
		}),
		new OpenAPIReferenceHandlerPlugin({
			spec: specFromRouter,
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
