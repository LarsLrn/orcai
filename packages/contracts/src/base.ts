import {
	errorDataSchema,
	forbiddenErrorDataSchema,
	notFoundErrorDataSchema,
} from "@orcai/schema";
import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";

export const base = oc
	.meta(
		openapi({
			spec: (s) => ({
				...s,
				security: [
					{
						test: [],
					},
				],
			}),
		}),
	)
	.errors({
		FORBIDDEN: {
			data: forbiddenErrorDataSchema,
			message: "Forbidden access.",
			status: 403,
		},
		UNAUTHORIZED: {
			data: errorDataSchema,
			message: "Unauthorized access.",
			status: 401,
		},
		BAD_REQUEST: {
			data: errorDataSchema,
			message: "Bad request.",
			status: 400,
		},
		CONFLICT: {
			data: errorDataSchema,
			message: "Conflict.",
			status: 409,
		},
		NOT_FOUND: {
			data: notFoundErrorDataSchema,
			message: "Resource not found.",
			status: 404,
		},
		INTERNAL_SERVER_ERROR: {
			message: "Internal server error.",
			status: 500,
		},
	});
