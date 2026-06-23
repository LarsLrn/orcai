import {
	bootstrapInitializeInputSchema,
	bootstrapInitializeResponseSchema,
	bootstrapStatusInputSchema,
	bootstrapStatusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

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
			}),
		)
		.input(bootstrapInitializeInputSchema)
		.output(bootstrapInitializeResponseSchema),
};
