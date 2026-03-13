import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { metadataSchema } from "./fragments/asset-metadata";
import { processingStatusSchema } from "./fragments/processing-status";
import { finalizedUploadFileSchema } from "./storage";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const assetSelectSchema = createSelectSchema(dbSchema.asset).extend({
	metadata: metadataSchema,
	processingStatus: processingStatusSchema,
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

export const assetSaveSchema = z
	.object({
		id: assetSelectSchema.shape.id.optional(),
		title: z.string().min(1, "Title is required"),
		metadata: metadataSchema,
		upload: finalizedUploadFileSchema.optional(),
	})
	.check((ctx) => {
		if (!ctx.value.id && !ctx.value.upload) {
			ctx.issues.push({
				code: "custom",
				message: "Either an existing asset id or an uploaded file is required.",
				path: [
					"upload",
				],
				input: ctx.value,
			});
		}
	});

export const assetSaveManySchema = z.object({
	assets: z.array(assetSaveSchema).min(1),
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
