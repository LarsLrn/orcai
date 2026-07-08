import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import {
	multipartCompletedPartSchema,
	storageUploadRouteSchema,
	uploadFileDescriptorSchema,
	uploadFileObjectSchema,
} from "./schema";

export const createUploadUrlsInputSchema = z.object({
	route: storageUploadRouteSchema.default("asset"),
	files: z.array(uploadFileDescriptorSchema).min(1),
	metadata: z.record(z.string(), z.string()).optional(),
});

export const createDownloadUrlInputSchema = z.object({
	id: assetIdSchema,
	objectKey: z.string().min(1).optional(),
});

export const finalizeUploadInputSchema = z.object({
	route: storageUploadRouteSchema.default("asset"),
	files: z.array(uploadFileObjectSchema).min(1),
});

const multipartControlBaseSchema = z.object({
	route: storageUploadRouteSchema.default("asset"),
	uploadId: z.string().min(1),
	file: uploadFileObjectSchema,
});

export const completeMultipartUploadInputSchema =
	multipartControlBaseSchema.extend({
		parts: z.array(multipartCompletedPartSchema).min(1),
	});

export const abortMultipartUploadInputSchema = multipartControlBaseSchema;

export type CreateUploadUrlsInput = z.infer<typeof createUploadUrlsInputSchema>;
export type CreateDownloadUrlInput = z.infer<
	typeof createDownloadUrlInputSchema
>;
export type FinalizeUploadInput = z.infer<typeof finalizeUploadInputSchema>;
export type CompleteMultipartUploadInput = z.infer<
	typeof completeMultipartUploadInputSchema
>;
export type AbortMultipartUploadInput = z.infer<
	typeof abortMultipartUploadInputSchema
>;
