import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { organizationProviderTable } from "@/db/schema/model";
import { base } from "./base";

export const organizationProviderSelectSchema = createSelectSchema(
	organizationProviderTable,
);

export const organizationProviderInsertSchema = createInsertSchema(
	organizationProviderTable,
).omit({
	createdAt: true,
});

export const organizationProviderUpdateSchema = createUpdateSchema(
	organizationProviderTable,
	{
		organizationId: organizationProviderSelectSchema.shape.organizationId,
		providerSlug: organizationProviderSelectSchema.shape.providerSlug,
	},
);

export const organizationProviderDeleteSchema = z.object({
	organizationId: z.uuidv4(),
	refs: z.array(organizationProviderUpdateSchema.pick({ providerSlug: true })),
});

export const listOrganizationProvidersContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/providers",
		summary: "List all providers of an organization",
		tags: ["Organization Providers"],
	})
	.input(
		z.object({
			organizationId: z.uuidv4(),
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
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
		path: "/organizations/{organizationId}/providers/{userId}",
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
		path: "/organizations/{organizationId}/providers/{userId}",
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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
