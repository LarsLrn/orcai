import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { document } from "@/db/schema/document";
import { base } from "./base";

export const assetSelectSchema = createSelectSchema(document);

export const assetInsertSchema = createInsertSchema(document).omit({
	createdAt: true,
	updatedAt: true,
	bucket: true,
	prefix: true,
	uploadedBy: true,
});

export const assetUpdateSchema = createUpdateSchema(document, {
	id: z.uuidv4(),
}).omit({ updatedAt: true, createdAt: true });

export const assetDeleteSchema = z.object({
	refs: z.array(assetUpdateSchema.pick({ id: true })),
});

export const listAssetsContract = base
	.route({
		method: "GET",
		path: "/assets",
		summary: "List all assets",
		tags: ["Assets"],
	})
	.input(
		z.object({
			courseId: z.uuidv4(),
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
	.output(z.object({ data: z.array(assetSelectSchema), rowCount: z.number() }));

export const createAssetContract = base
	.route({
		method: "POST",
		path: "/assets",
		summary: "Create an asset",
		tags: ["Assets"],
	})
	.input(assetInsertSchema)
	.output(assetSelectSchema);

export const findAssetContract = base
	.route({
		method: "GET",
		path: "/assets/{id}",
		summary: "Find an asset",
		tags: ["Assets"],
	})
	.input(assetSelectSchema.pick({ id: true }))
	.output(z.object({ data: assetSelectSchema }));

export const updateAssetContract = base
	.route({
		method: "PUT",
		path: "/assets/{id}",
		summary: "Update an asset",
		tags: ["Assets"],
	})
	.errors({
		NOT_FOUND: {
			message: "Asset not found",
			data: z.object({ id: assetUpdateSchema.shape.id }),
		},
	})
	.input(assetUpdateSchema)
	.output(z.object({ data: assetSelectSchema }));

export const deleteAssetContract = base
	.route({
		method: "DELETE",
		path: "/assets",
		summary: "Delete an asset",
		tags: ["Assets"],
	})
	.input(assetDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
