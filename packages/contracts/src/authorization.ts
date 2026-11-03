import {
	authorizationCheckInputSchema,
	authorizationCheckManyInputSchema,
	authorizationCheckManyResponseSchema,
	authorizationCheckResponseSchema,
	organizationCapabilitiesInputSchema,
	organizationCapabilitiesResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Authorization",
		],
	}),
);

export const authorizationContracts = {
	check: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/check",
				summary: "Check one entity capability",
			}),
		)
		.input(authorizationCheckInputSchema)
		.output(authorizationCheckResponseSchema),
	checkMany: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/check-many",
				summary: "Check many entity capabilities",
			}),
		)
		.input(authorizationCheckManyInputSchema)
		.output(authorizationCheckManyResponseSchema),
	organizationCapabilities: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/organization-capabilities",
				summary: "Check active organisation capabilities",
			}),
		)
		.input(organizationCapabilitiesInputSchema)
		.output(organizationCapabilitiesResponseSchema),
};
