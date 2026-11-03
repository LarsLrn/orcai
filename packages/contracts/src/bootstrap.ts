import {
	bootstrapInitializeInputSchema,
	bootstrapInitializeResponseSchema,
	bootstrapStatusInputSchema,
	bootstrapStatusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base, withoutSession } from "./base";

export const bootstrapContracts = {
	status: base
		.meta(
			openapi({
				method: "GET",
				path: "/bootstrap/status",
				summary: "Get bootstrap status",
				tags: [
					"Bootstrap",
				],
				spec: withoutSession,
			}),
		)
		.input(bootstrapStatusInputSchema)
		.output(bootstrapStatusResponseSchema),
	initialize: base
		.meta(
			openapi({
				method: "POST",
				path: "/bootstrap/initialize",
				summary: "Initialize application",
				tags: [
					"Bootstrap",
				],
				spec: withoutSession,
			}),
		)
		.input(bootstrapInitializeInputSchema)
		.output(bootstrapInitializeResponseSchema),
};
