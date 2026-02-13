import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { providerCompatibilities } from "@/lib/ai/providers";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const providerCompatibilitySchema = z.enum(
	providerCompatibilities.map((comp) => comp.value),
);

export const providerSelectSchema = createSelectSchema(dbSchema.provider, {
	compatibility: providerCompatibilitySchema,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const providerInsertSchema = createInsertSchema(dbSchema.provider, {
	compatibility: providerSelectSchema.shape.compatibility,
})
	.omit({
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

export const providerUpdateSchema = createUpdateSchema(dbSchema.provider, {
	id: providerSelectSchema.shape.id,
	compatibility: providerSelectSchema.shape.compatibility,
})
	.omit({
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

export const providerDeleteSchema = z.object({
	refs: z.array(providerUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type ProviderCompatibility = z.infer<typeof providerCompatibilitySchema>;

export type Provider = z.infer<typeof providerSelectSchema>;
export type ProviderInsert = z.infer<typeof providerInsertSchema>;
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;
export type ProviderDelete = z.infer<typeof providerDeleteSchema>;
