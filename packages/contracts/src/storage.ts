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

const tagged = base.meta(
	openapi({
		tags: [
			"Files",
		],
	}),
);

export const storageContracts = {
	createUploadUrls: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/files/upload",
				summary: "Create file upload URLs",
			}),
		)
		.input(createUploadUrlsInputSchema)
		.output(createUploadUrlsResponseSchema),
	createDownloadUrl: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/files/download",
				summary: "Create a file download URL",
			}),
		)
		.input(createDownloadUrlInputSchema)
		.output(createDownloadUrlResponseSchema),
	completeMultipartUpload: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/files/multipart/complete",
				summary: "Complete multipart upload on server",
			}),
		)
		.input(completeMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
	abortMultipartUpload: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/files/multipart/abort",
				summary: "Abort multipart upload on server",
			}),
		)
		.input(abortMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
};
