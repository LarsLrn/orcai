import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { BucketName } from "@/settings/buckets";
import type { FilePayload } from "@/types/file";
import { s3Client } from "./s3-client";
import { createBucketIfNotExists } from "./utils";

/**
 * Generate presigned urls for downloading files from S3
 * @returns promise with array of presigned urls
 */
export async function createPresignedUrlToDownload({
	bucket,
	prefix,
	id,
	type,
	expiry = 60 * 60, // 1 hour
}: FilePayload) {
	const filePath = `${prefix}/${id}.${type}`;

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: filePath,
	});

	return await getSignedUrl(s3Client, command, { expiresIn: expiry });
}

/**
 * List files urls in bucket by prefix
 * @returns promise with array of file references
 */
export async function listFiles({
	bucket,
	prefix,
}: {
	bucket: string;
	prefix: string;
}) {
	const command = new ListObjectsV2Command({
		Bucket: bucket,
		Prefix: prefix,
	});

	return await s3Client.send(command);
}

/**
 * Delete file from S3 bucket
 * @returns true if file was deleted, false if not
 */
export async function deleteFileFromBucket({
	bucket,
	prefix,
	id,
	type,
}: Omit<FilePayload, "expiry">) {
	const filePath = `${prefix}/${id}.${type}`;

	try {
		const command = new DeleteObjectCommand({
			Bucket: bucket,
			Key: filePath,
		});
		await s3Client.send(command);
	} catch (error) {
		console.error(error);
		return false;
	}
	return true;
}

export async function deletePrefixRecursively({
	bucket,
	prefix,
}: {
	bucket: BucketName;
	prefix: string;
}) {
	// Create bucket if it doesn't exist
	const status = await createBucketIfNotExists(bucket);

	if (status.status === "forbidden") {
		throw new Error("Bucket is not allowed");
	}

	// List all objects with the prefix
	const listCommand = new ListObjectsV2Command({
		Bucket: bucket,
		Prefix: prefix,
	});

	const result = await s3Client.send(listCommand);

	if (!result.Contents || result.Contents.length === 0) {
		return;
	}

	// Delete all objects
	const deletePromises = result.Contents.map((object) => {
		if (!object.Key) return;
		const deleteCommand = new DeleteObjectCommand({
			Bucket: bucket,
			Key: object.Key,
		});
		return s3Client.send(deleteCommand);
	});

	await Promise.all(deletePromises);
}

/**
 * Lists all files in a bucket with the given prefix
 * @returns Promise with array of file objects
 */
export async function listAllFilesInPrefix({
	bucket,
	prefix,
}: {
	bucket: BucketName;
	prefix: string;
}) {
	const command = new ListObjectsV2Command({
		Bucket: bucket,
		Prefix: prefix,
	});

	const result = await s3Client.send(command);

	if (!result.Contents) {
		return [];
	}

	return result.Contents.map((object) => ({
		name: object.Key || "",
		lastModified: object.LastModified,
		size: object.Size,
	}));
}

export async function getMarkdownAsString({
	bucket,
	name,
}: {
	bucket: BucketName;
	name: string;
}) {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: name,
	});

	const response = await s3Client.send(command);

	if (!response.Body) {
		throw new Error("No body in response");
	}

	const chunks: Uint8Array[] = [];
	const stream = response.Body as any;

	return new Promise((resolve, reject) => {
		stream.on("data", (chunk: any) => chunks.push(chunk));
		stream.on("end", () => {
			const buffer = Buffer.concat(chunks);
			const markdownContent = buffer.toString("utf-8");
			resolve(markdownContent);
		});
		stream.on("error", reject);
	});
}

export async function getImageAsBase64({
	bucket,
	name,
}: {
	bucket: BucketName;
	name: string;
}) {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: name,
	});

	const response = await s3Client.send(command);

	if (!response.Body) {
		throw new Error("No body in response");
	}

	const chunks: Uint8Array[] = [];
	const stream = response.Body as any;

	return new Promise<string>((resolve, reject) => {
		stream.on("data", (chunk: any) => chunks.push(chunk));
		stream.on("end", () => {
			const buffer = Buffer.concat(chunks);
			const base64Image = buffer.toString("base64");
			resolve(base64Image);
		});
		stream.on("error", reject);
	});
}
