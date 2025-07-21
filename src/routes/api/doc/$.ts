import { experimental_SmartCoercionPlugin as SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import {
	BatchHandlerPlugin,
	SimpleCsrfProtectionHandlerPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createServerFileRoute } from "@tanstack/react-start/server";
import { router } from "@/lib/orpc/router";

const openAPIGenerator = new OpenAPIGenerator({
	schemaConverters: [
		new ZodToJsonSchemaConverter(), // <-- if you use Zod
	],
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
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
	plugins: [
		new BatchHandlerPlugin(),
		/**
		 * Restricts GET methods to only use GET requests:
		 * https://orpc.unnoq.com/docs/plugins/strict-get-method
		 */
		new StrictGetMethodPlugin(),
		/**
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

export const ServerRoute = createServerFileRoute("/api/doc/$").methods({
	HEAD: handle,
	GET: handle,
	POST: handle,
	PUT: handle,
	PATCH: handle,
	DELETE: handle,
});
