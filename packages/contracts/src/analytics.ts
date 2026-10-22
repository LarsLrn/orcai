import {
	analyticsInputSchema,
	instanceAnalyticsResponseSchema,
	organizationAnalyticsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const analyticsContracts = {
	organization: base
		.meta(
			openapi({
				method: "GET",
				path: "/analytics/organization",
				summary: "Usage and ratings of the active organization",
				tags: [
					"Analytics",
				],
			}),
		)
		.input(analyticsInputSchema)
		.output(organizationAnalyticsResponseSchema),
	instance: base
		.meta(
			openapi({
				method: "GET",
				path: "/analytics/instance",
				summary: "Usage of every organization",
				tags: [
					"Analytics",
				],
			}),
		)
		.input(analyticsInputSchema)
		.output(instanceAnalyticsResponseSchema),
};
