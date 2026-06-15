import { z } from "zod/v4";

export const STORAGE_UPLOAD_ROUTES = [
	"asset",
	"chatAttachment",
] as const;

export const storageUploadRouteSchema = z.enum(STORAGE_UPLOAD_ROUTES);

export const uploadFileDescriptorSchema = z.object({
	name: z.string().min(1),
	size: z.number().int().min(1),
	type: z.string().min(1),
});

export const uploadFileObjectSchema = z.object({
	objectKey: z.string(),
	objectMetadata: z.record(z.string(), z.string()),
	name: z.string(),
	size: z.number().int().min(1),
	type: z.string(),
});

const singleUploadTargetSchema = z.object({
	mode: z.literal("single"),
	signedUrl: z.url(),
	headers: z.record(z.string(), z.string()).optional(),
	file: uploadFileObjectSchema,
});

const multipartUploadTargetSchema = z.object({
	mode: z.literal("multipart"),
	parts: z
		.array(
			z.object({
				signedUrl: z.url(),
				partNumber: z.number().int().positive(),
				size: z.number().int().positive(),
			}),
		)
		.min(1),
	partSize: z.number().int().positive(),
	uploadId: z.string(),
	file: uploadFileObjectSchema,
});

export const storageUploadTargetSchema = z.discriminatedUnion("mode", [
	singleUploadTargetSchema,
	multipartUploadTargetSchema,
]);

export const multipartCompletedPartSchema = z.object({
	etag: z.string().min(1),
	partNumber: z.number().int().positive(),
});

export type StorageUploadRoute = z.infer<typeof storageUploadRouteSchema>;
export type UploadFileDescriptor = z.infer<typeof uploadFileDescriptorSchema>;
export type UploadFileObject = z.infer<typeof uploadFileObjectSchema>;
export type StorageUploadTarget = z.infer<typeof storageUploadTargetSchema>;
export type MultipartCompletedPart = z.infer<
	typeof multipartCompletedPartSchema
>;
