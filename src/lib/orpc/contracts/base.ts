import { oc } from "@orpc/contract";
import { z } from "zod/v4";

export const base = oc
	.$route({
		spec: (s) => ({
			...s,
			security: [{ test: [] }],
		}),
	})
	.errors({
		FORBIDDEN: {
			data: z.object({
				allowed: z.boolean(),
				action: z.string().optional(),
				entityType: z.string().optional(),
				zedToken: z.string().optional(),
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
		NOT_FOUND: {
			message: "Resource not found.",
			status: 404,
		},
	});
