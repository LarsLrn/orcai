import { z } from "zod/v4";
import { assetSelectSchema } from "@/lib/orpc/schemas/asset";
import { storageSelectSchema } from "@/lib/orpc/schemas/storage";
import { base } from "./base";

export const createUploadUrlsContract = base
	.route({
		method: "POST",
		path: "/files/upload",
		summary: "Create file upload URLs",
		tags: ["Files"],
	})
	.input(
		z.object({
			files: z.array(
				z.object({
					name: z.string(),
					size: z.number().int().min(1),
					// TODO: Narrow file types
					type: z.string(),
				}),
			),
		}),
	)
	.output(
		z.object({
			data: z.array(storageSelectSchema),
		}),
	);

export const createDownloadUrlContract = base
	.route({
		method: "POST",
		path: "/files/download",
		summary: "Create a file download URL",
		tags: ["Files"],
	})
	.input(
		assetSelectSchema.pick({
			id: true,
			prefix: true,
			bucket: true,
			fileType: true,
		}),
	)
	.output(
		z.object({
			url: storageSelectSchema.shape.signedUrl,
		}),
	);
