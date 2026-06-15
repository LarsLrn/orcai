import {
	abortMultipartUploadInputSchema,
	completeMultipartUploadInputSchema,
	createDownloadUrlInputSchema,
	createDownloadUrlResponseSchema,
	createUploadUrlsInputSchema,
	createUploadUrlsResponseSchema,
	finalizeUploadInputSchema,
	finalizeUploadResponseSchema,
	multipartUploadControlResponseSchema,
} from "@orcai/schema";
import { base } from "./base";

export const storageContracts = {
	createUploadUrls: base
		.route({
			method: "POST",
			path: "/files/upload",
			summary: "Create file upload URLs",
			tags: [
				"Files",
			],
		})
		.input(createUploadUrlsInputSchema)
		.output(createUploadUrlsResponseSchema),
	createDownloadUrl: base
		.route({
			method: "POST",
			path: "/files/download",
			summary: "Create a file download URL",
			tags: [
				"Files",
			],
		})
		.input(createDownloadUrlInputSchema)
		.output(createDownloadUrlResponseSchema),
	finalizeUpload: base
		.route({
			method: "POST",
			path: "/files/finalize",
			summary: "Finalize uploaded files and return validated upload references",
			tags: [
				"Files",
			],
		})
		.input(finalizeUploadInputSchema)
		.output(finalizeUploadResponseSchema),
	completeMultipartUpload: base
		.route({
			method: "POST",
			path: "/files/multipart/complete",
			summary: "Complete multipart upload on server",
			tags: [
				"Files",
			],
		})
		.input(completeMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
	abortMultipartUpload: base
		.route({
			method: "POST",
			path: "/files/multipart/abort",
			summary: "Abort multipart upload on server",
			tags: [
				"Files",
			],
		})
		.input(abortMultipartUploadInputSchema)
		.output(multipartUploadControlResponseSchema),
};
