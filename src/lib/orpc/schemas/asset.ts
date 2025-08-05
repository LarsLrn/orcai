import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { assetTable } from "@/db/schema/asset";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const assetSelectSchema = createSelectSchema(assetTable);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const assetInsertSchema = createInsertSchema(assetTable).omit({
	createdAt: true,
	updatedAt: true,
	bucket: true,
	prefix: true,
	userId: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const assetUpdateSchema = createUpdateSchema(assetTable, {
	id: assetSelectSchema.shape.id,
}).omit({ updatedAt: true, createdAt: true });

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const assetDeleteSchema = z.object({
	refs: z.array(assetSelectSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Asset = z.infer<typeof assetSelectSchema>;
export type AssetInsert = z.infer<typeof assetInsertSchema>;
export type AssetUpdate = z.infer<typeof assetUpdateSchema>;
export type AssetDelete = z.infer<typeof assetDeleteSchema>;
