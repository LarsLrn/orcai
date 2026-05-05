import { dbSchema } from "@orcai/db/schema";
import {
	organizationIdSchema,
	providerCompatibilitySchema,
	providerIdSchema,
	providerMeteringModeSchema,
} from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const providerSelectSchema = createSelectSchema(dbSchema.provider, {
	id: providerIdSchema,
	compatibility: providerCompatibilitySchema,
	meteringMode: providerMeteringModeSchema,
	organizationId: organizationIdSchema,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const providerInsertSchema = createInsertSchema(dbSchema.provider, {
	id: providerSelectSchema.shape.id.optional(),
	compatibility: providerSelectSchema.shape.compatibility,
	meteringMode: providerSelectSchema.shape.meteringMode,
})
	.omit({
		createdAt: true,
		apiKeyEncrypted: true, // Remove encrypted field from input
		organizationId: true,
	})
	.extend({
		apiKey: z.string().min(1, "API key is required"), // Add plain text API key input
	});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const providerUpdateSchema = createUpdateSchema(dbSchema.provider, {
	id: providerSelectSchema.shape.id,
	compatibility: providerSelectSchema.shape.compatibility,
	meteringMode: providerSelectSchema.shape.meteringMode,
})
	.omit({
		apiKeyEncrypted: true, // Remove encrypted field from input
		organizationId: true,
	})
	.extend({
		apiKey: z.string().min(1, "API key is required").optional(), // Add optional plain text API key input for updates
	});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const providerDeleteSchema = z.object({
	refs: z.array(
		providerUpdateSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Provider = z.infer<typeof providerSelectSchema>;
export type ProviderInsert = z.infer<typeof providerInsertSchema>;
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;
export type ProviderDelete = z.infer<typeof providerDeleteSchema>;
