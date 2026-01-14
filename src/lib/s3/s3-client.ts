import { S3Client } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/env/server";

export const s3Client = new S3Client({
	region: serverEnv.S3_REGION,
	endpoint: serverEnv.S3_ENDPOINT,
	credentials: {
		accessKeyId: serverEnv.S3_ACCESS_KEY,
		secretAccessKey: serverEnv.S3_SECRET_KEY,
	},
	forcePathStyle: true, // Use path-style URLs for S3
});
