import { UPLOAD_ROUTES } from "@orcai/s3";
import { finalizedUploadFileSchema } from "@orcai/schema";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const uploadRouteValues = Object.keys(UPLOAD_ROUTES) as [
	keyof typeof UPLOAD_ROUTES,
	...(keyof typeof UPLOAD_ROUTES)[],
];

export const uploadRouteSchema = z.enum(uploadRouteValues);

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

const singleUploadSelectSchema = z.object({
	mode: z.literal("single"),
	signedUrl: z.url(),
	headers: z.record(z.string(), z.string()).optional(),
	file: uploadFileObjectSchema,
});

const multipartUploadSelectSchema = z.object({
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

export const storageSelectSchema = z.discriminatedUnion("mode", [
	singleUploadSelectSchema,
	multipartUploadSelectSchema,
]);

export const createUploadUrlsInputSchema = z.object({
	route: uploadRouteSchema.default("asset"),
	files: z.array(uploadFileDescriptorSchema).min(1),
	metadata: z.record(z.string(), z.string()).optional(),
});

export const finalizeUploadInputSchema = z.object({
	route: uploadRouteSchema.default("asset"),
	files: z.array(uploadFileObjectSchema).min(1),
});

export const finalizeUploadOutputSchema = z.object({
	data: z.array(finalizedUploadFileSchema),
});

const multipartCompletedPartSchema = z.object({
	etag: z.string().min(1),
	partNumber: z.number().int().positive(),
});

const multipartControlBaseSchema = z.object({
	route: uploadRouteSchema.default("asset"),
	uploadId: z.string().min(1),
	file: uploadFileObjectSchema,
});

export const completeMultipartUploadInputSchema =
	multipartControlBaseSchema.extend({
		parts: z.array(multipartCompletedPartSchema).min(1),
	});

export const abortMultipartUploadInputSchema = multipartControlBaseSchema;

export const multipartUploadControlOutputSchema = z.object({
	ok: z.boolean(),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Storage = z.infer<typeof storageSelectSchema>;
