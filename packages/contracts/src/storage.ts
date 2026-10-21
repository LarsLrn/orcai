import {
	abortMultipartUploadInputSchema,
	completeMultipartUploadInputSchema,
	createDownloadUrlInputSchema,
	createDownloadUrlResponseSchema,
	createUploadUrlsInputSchema,
	createUploadUrlsResponseSchema,
	multipartUploadControlResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const storageContracts = {
	createUploadUrls: base
		.meta(
			openapi({
				method: "POST",
				path: "/files/upload",
				summary: "Create file upload URLs",
				tags: [
					"Files",
				],
			}),
		)
		.input(createUploadUrlsInputSchema)
		.output(createUploadUrlsResponseSchema),
	createDownloadUrl: base
		.meta(
			openapi({
				method: "POST",
				path: "/files/download",
				summary: "Create a file download URL",
				tags: [
					"Files",
				],
			}),
		)
		.input(createDownloadUrlInputSchema)
		.output(createDownloadUrlResponseSchema),
	completeMultipartUpload: base
		.meta(
			openapi({
				method: "POST",
				path: "/files/multipart/complete",
				summary: "Complete multipart upload on server",
				tags: [
					"Files",
				],
			}),
		)
		.input(completeMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
	abortMultipartUpload: base
		.meta(
			openapi({
				method: "POST",
				path: "/files/multipart/abort",
				summary: "Abort multipart upload on server",
				tags: [
					"Files",
				],
			}),
		)
		.input(abortMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
};
