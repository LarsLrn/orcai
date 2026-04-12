import { z } from "zod/v4";
import { assetSelectSchema } from "@/lib/orpc/schemas/asset";
import {
	abortMultipartUploadInputSchema,
	completeMultipartUploadInputSchema,
	createUploadUrlsInputSchema,
	finalizeUploadInputSchema,
	finalizeUploadOutputSchema,
	multipartUploadControlOutputSchema,
	storageSelectSchema,
} from "@/lib/orpc/schemas/storage";
import { base } from "./base";

export const createUploadUrlsContract = base
	.route({
		method: "POST",
		path: "/files/upload",
		summary: "Create file upload URLs",
		tags: [
			"Files",
		],
	})
	.input(createUploadUrlsInputSchema)
	.output(
		z.object({
			data: z.array(storageSelectSchema),
			metadata: z.record(z.string(), z.string()),
		}),
	);

export const createDownloadUrlContract = base
	.route({
		method: "POST",
		path: "/files/download",
		summary: "Create a file download URL",
		tags: [
			"Files",
		],
	})
	.input(
		assetSelectSchema
			.pick({
				id: true,
			})
			.extend({
				objectKey: z.string().min(1).optional(),
			}),
	)
	.output(
		z.object({
			url: z.url(),
		}),
	);

export const finalizeUploadContract = base
	.route({
		method: "POST",
		path: "/files/finalize",
		summary: "Finalize uploaded files and return validated upload references",
		tags: [
			"Files",
		],
	})
	.input(finalizeUploadInputSchema)
	.output(finalizeUploadOutputSchema);

export const completeMultipartUploadContract = base
	.route({
		method: "POST",
		path: "/files/multipart/complete",
		summary: "Complete multipart upload on server",
		tags: [
			"Files",
		],
	})
	.input(completeMultipartUploadInputSchema)
	.output(multipartUploadControlOutputSchema);

export const abortMultipartUploadContract = base
	.route({
		method: "POST",
		path: "/files/multipart/abort",
		summary: "Abort multipart upload on server",
		tags: [
			"Files",
		],
	})
	.input(abortMultipartUploadInputSchema)
	.output(multipartUploadControlOutputSchema);
