import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { organizationProviderTable } from "@/db/schema/model";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const organizationProviderSelectSchema = createSelectSchema(
	organizationProviderTable,
);

export const organizationProviderInsertSchema = createInsertSchema(
	organizationProviderTable,
)
	.omit({
		createdAt: true,
		apiKeyEncrypted: true, // Remove encrypted field from input
	})
	.extend({
		apiKey: z.string().min(1, "API key is required"), // Add plain text API key input
	});

export const organizationProviderUpdateSchema = createUpdateSchema(
	organizationProviderTable,
	{
		organizationId: organizationProviderSelectSchema.shape.organizationId,
		providerSlug: organizationProviderSelectSchema.shape.providerSlug,
	},
)
	.omit({
		apiKeyEncrypted: true, // Remove encrypted field from input
	})
	.extend({
		apiKey: z.string().min(1, "API key is required").optional(), // Add optional plain text API key input for updates
	});

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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
