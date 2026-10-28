import {
	findOrganizationReadinessInputSchema,
	findOrganizationReadinessResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const readinessContracts = {
	organization: base
		.meta(
			openapi({
				method: "GET",
				path: "/readiness/organization",
				summary:
					"What the active organization still needs before members can chat",
				tags: [
					"Readiness",
				],
				description: "Derived live from the organization's configuration.",
			}),
		)
		.input(findOrganizationReadinessInputSchema)
		.output(findOrganizationReadinessResponseSchema),
};
