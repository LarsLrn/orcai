import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createFileRoute } from "@tanstack/react-router";
import {
	serveUnder,
	sharedHandlerOptions,
} from "@/lib/orpc/implementation/handler";
import { router } from "@/lib/orpc/router";
import { HEADERS } from "@/settings/constants";

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
		// The ZedToken is optional, so a request may send the bearer token alone.
		security: [
			{
				bearerAuth: [],
			},
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

const shared = sharedHandlerOptions();

const openAPIHandler = new OpenAPIHandler(router, {
	...shared,
	plugins: [
		...shared.plugins,
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
			ANY: serveUnder(openAPIHandler, "/api/doc"),
		},
	},
});
