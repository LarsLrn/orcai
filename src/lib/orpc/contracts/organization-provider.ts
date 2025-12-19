import { z } from "zod/v4";
import {
	organizationProviderDeleteSchema,
	organizationProviderInsertSchema,
	organizationProviderSelectSchema,
	organizationProviderUpdateSchema,
} from "@/lib/orpc/schemas/organization-provider";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listOrganizationProvidersContract = base
	.route({
		method: "GET",
		path: "/organization/providers",
		summary: "List all providers of the active organization",
		tags: ["Organization Providers"],
	})
	.input(paginationSchema)
	.output(
		z.object({
			data: z.array(organizationProviderSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createOrganizationProviderContract = base
	.route({
		method: "POST",
		path: "/organization/providers",
		summary: "Create a provider for the active organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderInsertSchema)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const findOrganizationProviderContract = base
	.route({
		method: "GET",
		path: "/organization/providers/{providerSlug}",
		summary: "Find a provider for the active organization",
		tags: ["Organization Providers"],
	})
	.input(
		organizationProviderSelectSchema.pick({
			providerSlug: true,
		}),
	)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const updateOrganizationProviderContract = base
	.route({
		method: "PUT",
		path: "/organization/providers/{providerSlug}",
		summary: "Update a provider for the active organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderUpdateSchema)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const deleteOrganizationProviderContract = base
	.route({
		method: "DELETE",
		path: "/organization/providers",
		summary: "Delete a provider for the active organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderDeleteSchema)
	.output(statusSchema);
