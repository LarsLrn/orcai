import { trace } from "@opentelemetry/api";
import { experimental_SmartCoercionPlugin as SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import {
	BatchHandlerPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { router } from "@/lib/orpc/router";

const openAPIGenerator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});

const specFromRouter = await openAPIGenerator.generate(router, {
	info: {
		title: "SokratesT API Documentation",
		version: "1.0.0",
	},
	security: [{ bearerAuth: [] }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
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
			console.error(error);
		}),
		({ request, next }) => {
			const span = trace.getActiveSpan();

			request.signal?.addEventListener("abort", () => {
				span?.addEvent("aborted", { reason: String(request.signal?.reason) });
			});

			return next();
		},
	],
	plugins: [
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
		new SmartCoercionPlugin(),
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: specFromRouter,
			docsConfig: {
				authentication: {
					securitySchemes: {
						bearerAuth: {
							token: "default-token",
						},
					},
				},
			},
		}),
	],
});

async function handle({ request }: { request: Request }) {
	const { response } = await openAPIHandler.handle(request, {
		prefix: "/api/doc",
		context: {},
	});

	return response ?? new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/api/doc/$")({
	server: {
		handlers: {
			HEAD: handle,
			GET: handle,
			POST: handle,
			PUT: handle,
			PATCH: handle,
			DELETE: handle,
		},
	},
});
