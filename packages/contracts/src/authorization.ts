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

export const authorizationContracts = {
	check: base
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/check",
				summary: "Check one entity capability",
				tags: [
					"Authorization",
				],
			}),
		)
		.input(authorizationCheckInputSchema)
		.output(authorizationCheckResponseSchema),
	checkMany: base
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/check-many",
				summary: "Check many entity capabilities",
				tags: [
					"Authorization",
				],
			}),
		)
		.input(authorizationCheckManyInputSchema)
		.output(authorizationCheckManyResponseSchema),
	organizationCapabilities: base
		.meta(
			openapi({
				method: "POST",
				path: "/authorization/organization-capabilities",
				summary: "Check active organization capabilities",
				tags: [
					"Authorization",
				],
			}),
		)
		.input(organizationCapabilitiesInputSchema)
		.output(organizationCapabilitiesResponseSchema),
};
