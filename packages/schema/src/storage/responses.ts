import { z } from "zod/v4";
import { finalizedUploadFileSchema } from "../asset";
import { storageUploadTargetSchema } from "./schema";

export const createUploadUrlsResponseSchema = z.object({
	data: z.array(storageUploadTargetSchema),
	metadata: z.record(z.string(), z.string()),
});

export const createDownloadUrlResponseSchema = z.object({
	url: z.url(),
});

export const finalizeUploadResponseSchema = z.object({
	data: z.array(finalizedUploadFileSchema),
});

export const multipartUploadControlResponseSchema = z.object({
	ok: z.boolean(),
});
