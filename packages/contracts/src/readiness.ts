import {
	findOrganizationReadinessInputSchema,
	findOrganizationReadinessResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Readiness",
		],
	}),
);

export const readinessContracts = {
	organization: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/readiness/organization",
				summary:
					"What the active organisation still needs before members can chat",
				description: "Derived live from the organisation's configuration.",
			}),
		)
		.input(findOrganizationReadinessInputSchema)
		.output(findOrganizationReadinessResponseSchema),
};
