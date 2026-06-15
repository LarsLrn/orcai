import { buckets } from "@orcai/core";
import z from "zod/v4";

export const bucketSchema = z.enum([
	buckets.main.name,
	buckets.processed.name,
]);

export type BucketName = z.infer<typeof bucketSchema>;
