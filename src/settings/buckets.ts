import z from "zod/v4";

export const buckets = {
	main: {
		name: process.env.NODE_ENV === "production" ? "sokratest" : "sokratest-dev",
	},
	processed: {
		name:
			process.env.NODE_ENV === "production"
				? "processed-files"
				: "processed-files-dev",
	},
};

export const bucketSchema = z.enum([
	buckets.main.name,
	buckets.processed.name,
]);

export type BucketName = z.infer<typeof bucketSchema>;
