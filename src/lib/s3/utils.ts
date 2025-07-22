import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { buckets } from "@/settings/buckets";
import { s3Client } from "./s3-client";

export async function createBucketIfNotExists(bucketName: string) {
	// TODO: Add this to an initialization script or migration instead of checking every time

	const allowedBuckets = Object.keys(buckets).map(
		(bucket) => buckets[bucket as keyof typeof buckets].name,
	);

	if (!allowedBuckets.includes(bucketName)) {
		return {
			status: "forbidden",
		};
	}

	try {
		// Check if bucket exists
		await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));

		return { status: "exists" };
	} catch (error: any) {
		// If bucket doesn't exist, create it
		// Handle both AWS and Supabase error names
		const is404Error =
			error?.name === "NoSuchBucket" ||
			error?.name === "NotFound" ||
			error?.message?.includes("NotFound") ||
			error?.$metadata?.httpStatusCode === 404 ||
			error?.statusCode === 404;

		if (is404Error) {
			try {
				await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
				// TODO: Add bucket policy
				return { status: "created" };
			} catch (createError) {
				throw new Error(`Failed to create bucket: ${createError}`);
			}
		}

		// Log the error for debugging
		console.error("Unexpected error in createBucketIfNotExists:", {
			name: error?.name,
			message: error?.message,
			metadata: error?.$metadata,
			statusCode: error?.statusCode,
		});
		throw error;
	}
}
