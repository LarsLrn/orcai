import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const storageSelectSchema = z.object({
	signedUrl: z.url(),
	file: z.object({
		objectKey: z.string(),
		objectMetadata: z.record(z.string(), z.string()),
		name: z.string(),
		size: z.number().int().min(1),
		type: z.string(),
	}),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Storage = z.infer<typeof storageSelectSchema>;
