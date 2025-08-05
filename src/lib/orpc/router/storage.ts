import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { authed } from "@/lib/orpc";
import { s3Client } from "@/lib/s3/s3-client";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { createBucketIfNotExists } from "@/lib/s3/utils";
import { buckets } from "@/settings/buckets";

export const createUploadUrls = authed.storage.createUploadUrls.handler(
	async ({ input }) => {
		const bucket = buckets.main.name;
		const expiry = 60 * 60;
		const prefix = "placeholder"; // TODO: Replace with actual prefix

		// Create bucket if it doesn't exist
		const status = await createBucketIfNotExists(bucket);

		if (status.status === "forbidden") {
			throw new Error("Bucket is not allowed");
		}

		const presignedUrls = await Promise.all(
			input.files.map(async (file) => {
				const id = uuidv4();
				const extension = getFileTypeFromMime(file.type);
				const filePath = `${prefix}/${id}.${extension}`;

				const command = new PutObjectCommand({
					Bucket: bucket,
					Key: filePath,
					ContentType: file.type,
				});

				const url = await getSignedUrl(s3Client, command, {
					expiresIn: expiry,
				});

				return {
					signedUrl: url,
					file: {
						objectKey: id,
						objectMetadata: { id },
						name: file.name,
						size: file.size,
						type: file.type,
					},
				};
			}),
		);

		return { data: presignedUrls };
	},
);

export const createDownloadUrl = authed.storage.createDownloadUrl.handler(
	async ({ input }) => {
		const expiry = 60 * 60;
		const extension = getFileTypeFromMime(input.fileType);
		const filePath = `${input.prefix}/${input.id}.${extension}`;

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
