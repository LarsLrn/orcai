import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetTable } from "@/db/schema/asset";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const metadataSchema = z.object({
	showReference: z.boolean(),
	relevance: z.enum(["high", "medium", "low"]),
	citation: z.string().optional(),
	externalUrl: z.string().optional(),
	pageRange: z.string().optional(),
	author: z.string().optional(),
	chapterTitle: z.string().optional(),
	mergePages: z.boolean().optional(),
});

export type AssetMetadataType = z.infer<typeof metadataSchema>;

export const assetSelectSchema = createSelectSchema(assetTable).extend({
	metadata: metadataSchema,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const assetInsertSchema = createInsertSchema(assetTable)
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
