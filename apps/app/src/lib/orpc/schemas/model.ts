import { modelCapabilities } from "@orcai/core";
import { dbSchema } from "@orcai/db/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";

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
	refs: z.array(
		modelUpdateSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Model = z.infer<typeof modelSelectSchema>;
