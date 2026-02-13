import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { modelCapabilities } from "@/lib/ai/providers";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const modelCapabilitiesSchema = z.enum(
	modelCapabilities.map((cap) => cap.value),
);

export const modelSelectSchema = createSelectSchema(dbSchema.model, {
	capabilities: z.array(modelCapabilitiesSchema),
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const modelInsertSchema = createInsertSchema(dbSchema.model, {
	capabilities: modelSelectSchema.shape.capabilities,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const modelUpdateSchema = createUpdateSchema(dbSchema.model, {
	id: modelSelectSchema.shape.id,
	capabilities: modelSelectSchema.shape.capabilities,
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const modelDeleteSchema = z.object({
	refs: z.array(modelUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type ModelCapability = z.infer<typeof modelCapabilitiesSchema>;

export type Model = z.infer<typeof modelSelectSchema>;
