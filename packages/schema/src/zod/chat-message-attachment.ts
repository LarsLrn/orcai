import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { bucketSchema } from "./buckets";

const attachmentSourceSchema = z.enum([
	"upload",
	"library",
]);

export const chatMessageAttachmentSchema = z.object({
	assetId: assetIdSchema,
	title: z.string().min(1),
	fileType: z.string().min(1),
	size: z.number().int().nonnegative(),
	bucket: bucketSchema,
	prefix: z.string().min(1),
	source: attachmentSourceSchema,
});

export type ChatMessageAttachment = z.infer<typeof chatMessageAttachmentSchema>;
