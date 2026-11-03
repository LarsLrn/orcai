import {
	analyticsInputSchema,
	instanceAnalyticsResponseSchema,
	organizationAnalyticsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Analytics",
		],
	}),
);

export const analyticsContracts = {
	organization: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/analytics/organization",
				summary: "Usage and ratings of the active organisation",
			}),
		)
		.input(analyticsInputSchema)
		.output(organizationAnalyticsResponseSchema),
	instance: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/analytics/instance",
				summary: "Usage of every organisation",
			}),
		)
		.input(analyticsInputSchema)
		.output(instanceAnalyticsResponseSchema),
};
