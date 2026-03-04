import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { metadataSchema } from "./fragments/asset-metadata";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const assetSelectSchema = createSelectSchema(dbSchema.asset).extend({
	metadata: metadataSchema,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const assetInsertSchema = createInsertSchema(dbSchema.asset)
	.omit({
		createdAt: true,
		updatedAt: true,
		bucket: true,
		prefix: true,
		userId: true,
	})
	.extend({
		metadata: metadataSchema.optional(),
	});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const assetUpdateSchema = assetInsertSchema
	.extend({
		id: assetSelectSchema.shape.id,
	})
	.omit({
		size: true,
		fileType: true,
	});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const assetDeleteSchema = z.object({
	refs: z.array(
		assetSelectSchema.pick({
			id: true,
		}),
	),
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
