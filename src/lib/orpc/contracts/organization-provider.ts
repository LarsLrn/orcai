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
		path: "/organizations/{organizationId}/providers",
		summary: "List all providers of an organization",
		tags: ["Organization Providers"],
	})
	.input(
		paginationSchema.extend({
			organizationId: z.uuidv4(),
		}),
	)
	.output(
		z.object({
			data: z.array(organizationProviderSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createOrganizationProviderContract = base
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/providers",
		summary: "Create a provider for an organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderInsertSchema)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const findOrganizationProviderContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/providers/{providerSlug}",
		summary: "Find a provider of an organization",
		tags: ["Organization Providers"],
	})
	.input(
		organizationProviderSelectSchema.pick({
			providerSlug: true,
			organizationId: true,
		}),
	)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const updateOrganizationProviderContract = base
	.route({
		method: "PUT",
		path: "/organizations/{organizationId}/providers/{providerSlug}",
		summary: "Update a provider of an organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderUpdateSchema)
	.output(z.object({ data: organizationProviderSelectSchema }));

export const deleteOrganizationProviderContract = base
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/providers",
		summary: "Delete a provider of an organization",
		tags: ["Organization Providers"],
	})
	.input(organizationProviderDeleteSchema)
	.output(statusSchema);
