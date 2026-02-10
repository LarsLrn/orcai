import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationProviderSelectSchema = createSelectSchema(
	dbSchema.organizationProvider,
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationProviderInsertSchema = createInsertSchema(
	dbSchema.organizationProvider,
)
	.omit({
		organizationId: true,
		createdAt: true,
		apiKeyEncrypted: true, // Remove encrypted field from input
	})
	.extend({
		apiKey: z.string().min(1, "API key is required"), // Add plain text API key input
	});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationProviderUpdateSchema = createUpdateSchema(
	dbSchema.organizationProvider,
	{
		providerSlug: organizationProviderSelectSchema.shape.providerSlug,
	},
)
	.omit({
		organizationId: true,
		apiKeyEncrypted: true, // Remove encrypted field from input
	})
	.extend({
		apiKey: z.string().min(1, "API key is required").optional(), // Add optional plain text API key input for updates
	});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationProviderDeleteSchema = z.object({
	refs: z.array(organizationProviderUpdateSchema.pick({ providerSlug: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type OrganizationProvider = z.infer<
	typeof organizationProviderSelectSchema
>;
export type OrganizationProviderInsert = z.infer<
	typeof organizationProviderInsertSchema
>;
export type OrganizationProviderUpdate = z.infer<
	typeof organizationProviderUpdateSchema
>;
export type OrganizationProviderDelete = z.infer<
	typeof organizationProviderDeleteSchema
>;
