import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
	region: "eu-central-1",
	endpoint: process.env.S3_ENDPOINT || "",
	// port: Number(process.env.S3_PORT) || undefined,
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY || "",
		secretAccessKey: process.env.S3_SECRET_KEY || "",
	},
	forcePathStyle: true, // Use path-style URLs for S3
});
