import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { authed } from "@/lib/orpc";
import { s3Client } from "@/lib/s3/s3-client";
import { createBucketIfNotExists } from "@/lib/s3/utils";
import { buckets } from "@/settings/buckets";

export const createUploadUrls = authed.storage.createUploadUrls.handler(
	async ({ input }) => {
		const bucket = buckets.main.name;
		const expiry = 60 * 60;
		const prefix = input.courseId;

		// Create bucket if it doesn't exist
		const status = await createBucketIfNotExists(bucket);

		if (status.status === "forbidden") {
			throw new Error("Bucket is not allowed");
		}

		const presignedUrls = await Promise.all(
			input.files.map(async (file) => {
				const id = uuidv4();
				const filePath = `${prefix}/${id}.${file.type}`;

				const command = new PutObjectCommand({
					Bucket: bucket,
					Key: filePath,
					ContentType: file.type,
				});

				const url = await getSignedUrl(s3Client, command, {
					expiresIn: expiry,
				});

				return {
					id,
					url,
					name: file.name,
					size: file.size,
					type: file.type,
				};
			}),
		);

		return { data: presignedUrls };
	},
);

export const createDownloadUrl = authed.storage.createDownloadUrl.handler(
	async ({ input }) => {
		const expiry = 60 * 60;
		const filePath = `${input.prefix}/${input.id}.${input.type}`;

		const command = new GetObjectCommand({
			Bucket: input.bucket,
			Key: filePath,
		});

		const presignedUrl = await getSignedUrl(s3Client, command, {
			expiresIn: expiry,
		});

		return { url: presignedUrl };
	},
);
