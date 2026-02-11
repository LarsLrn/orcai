import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as Effect from "effect/Effect";
import { S3Service } from "@/lib/effect/services/s3";
import { S3Error } from "@/lib/effect/utils/errors";
import type { BucketName } from "@/settings/buckets";
import type { FilePayload } from "@/types/file";
import { createBucketIfNotExists } from "./utils";

export const createPresignedUrlToDownload = ({
	bucket,
	prefix,
	id,
	type,
	expiry = 60 * 60, // 1 hour
}: FilePayload) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const filePath = `${prefix}/${id}.${type}`;

		return yield* Effect.tryPromise({
			try: () =>
				getSignedUrl(
					client,
					new GetObjectCommand({
						Bucket: bucket,
						Key: filePath,
					}),
					{
						expiresIn: expiry,
					},
				),
			catch: (cause) =>
				new S3Error({ operation: "createPresignedUrlToDownload", cause }),
		});
	});

export const listFiles = ({
	bucket,
	prefix,
}: {
	bucket: string;
	prefix: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		return yield* Effect.tryPromise({
			try: () =>
				client.send(
					new ListObjectsV2Command({
						Bucket: bucket,
						Prefix: prefix,
					}),
				),
			catch: (cause) => new S3Error({ operation: "listFiles", cause }),
		});
	});

export const deleteFileFromBucket = ({
	bucket,
	prefix,
	id,
	type,
}: Omit<FilePayload, "expiry">) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;
		const filePath = `${prefix}/${id}.${type}`;

		return yield* Effect.tryPromise({
			try: () =>
				client.send(
					new DeleteObjectCommand({
						Bucket: bucket,
						Key: filePath,
					}),
				),
			catch: (cause) =>
				new S3Error({ operation: "deleteFileFromBucket", cause }),
		});
	});

export const deletePrefixRecursively = ({
	bucket,
	prefix,
}: {
	bucket: BucketName;
	prefix: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		yield* createBucketIfNotExists(bucket);

		const result = yield* Effect.tryPromise({
			try: () =>
				client.send(
					new ListObjectsV2Command({
						Bucket: bucket,
						Prefix: prefix,
					}),
				),
			catch: (cause) =>
				new S3Error({ operation: "deletePrefixRecursively", cause }),
		});

		if (!result.Contents || result.Contents.length === 0) {
			return;
		}

		yield* Effect.forEach(
			result.Contents,
			(object) =>
				Effect.gen(function* () {
					if (!object.Key) return;

					const deleteCommand = new DeleteObjectCommand({
						Bucket: bucket,
						Key: object.Key,
					});

					yield* Effect.tryPromise({
						try: () => client.send(deleteCommand),
						catch: (cause) =>
							new S3Error({ operation: "deletePrefixRecursively", cause }),
					});
				}),
			{ concurrency: 10 },
		);
	});

export const listAllFilesInPrefix = ({
	bucket,
	prefix,
}: {
	bucket: BucketName;
	prefix: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		return yield* Effect.tryPromise({
			try: () =>
				client.send(
					new ListObjectsV2Command({
						Bucket: bucket,
						Prefix: prefix,
					}),
				),
			catch: (cause) =>
				new S3Error({ operation: "listAllFilesInPrefix", cause }),
		}).pipe(Effect.map((result) => result.Contents || []));
	});

const getObjectBytes = ({
	bucket,
	name,
}: {
	bucket: BucketName;
	name: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const response = yield* Effect.tryPromise({
			try: () =>
				client.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: name,
					}),
				),
			catch: (cause) => new S3Error({ operation: "getObjectBytes", cause }),
		});

		const body = yield* Effect.fromNullable(response.Body).pipe(
			Effect.orElseFail(
				() => new S3Error({ operation: "getObjectBytes", cause: "empty_body" }),
			),
		);

		return yield* Effect.tryPromise({
			try: () => body.transformToByteArray(),
			catch: (cause) => new S3Error({ operation: "getObjectBytes", cause }),
		});
	});

export const getMarkdownAsString = (input: {
	bucket: BucketName;
	name: string;
}) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("utf-8")),
	);

export const getImageAsBase64 = (input: { bucket: BucketName; name: string }) =>
	getObjectBytes(input).pipe(
		Effect.map((bytes) => Buffer.from(bytes).toString("base64")),
	);
