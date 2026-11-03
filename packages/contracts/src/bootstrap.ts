import {
	bootstrapInitializeInputSchema,
	bootstrapInitializeResponseSchema,
	bootstrapStatusInputSchema,
	bootstrapStatusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base, withoutSession } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Bootstrap",
		],
	}),
);

export const bootstrapContracts = {
	status: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/bootstrap/status",
				summary: "Get the instance's initialisation status",
				spec: withoutSession,
			}),
		)
		.input(bootstrapStatusInputSchema)
		.output(bootstrapStatusResponseSchema),
	initialize: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/bootstrap/initialize",
				summary: "Initialise the instance",
				spec: withoutSession,
			}),
		)
		.input(bootstrapInitializeInputSchema)
		.output(bootstrapInitializeResponseSchema),
};
