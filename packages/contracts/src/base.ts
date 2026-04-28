import { zedTokenSchema } from "@orcai/schema";
import { oc } from "@orpc/contract";
import { z } from "zod/v4";

export const base = oc
	.$route({
		spec: (s) => ({
			...s,
			security: [
				{
					test: [],
				},
			],
		}),
	})
	.errors({
		FORBIDDEN: {
			data: z.object({
				allowed: z.boolean(),
				permission: z.string().optional(),
				entityType: z.string().optional(),
				...zedTokenSchema.shape,
			}),
			message: "Forbidden access.",
			status: 403,
		},
		UNAUTHORIZED: {
			message: "Unauthorized access.",
			status: 401,
		},
		BAD_REQUEST: {
			message: "Bad request.",
			status: 400,
		},
		CONFLICT: {
			message: "Conflict.",
			status: 409,
		},
		NOT_FOUND: {
			message: "Resource not found.",
			status: 404,
		},
		INTERNAL_SERVER_ERROR: {
			message: "Internal server error.",
			status: 500,
		},
	});
