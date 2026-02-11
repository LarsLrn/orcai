import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { S3Service } from "@/lib/effect/services/s3";
import { S3Error } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { createBucketIfNotExists } from "@/lib/s3/utils";
import { buckets } from "@/settings/buckets";

export const createUploadUrls = authed.storage.createUploadUrls.handler(
	async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const { client } = yield* S3Service;

				const bucket = buckets.main.name;
				const expiry = 60 * 60;
				const prefix = "placeholder"; // TODO: Replace with actual prefix

				yield* createBucketIfNotExists(bucket);

				return yield* Effect.forEach(
					input.files,
					(file) =>
						Effect.gen(function* () {
							const id = uuidv4();
							const extension = getFileTypeFromMime(file.type);
							const filePath = `${prefix}/${id}.${extension}`;

							const command = new PutObjectCommand({
								Bucket: bucket,
								Key: filePath,
								ContentType: file.type,
							});

							return yield* Effect.tryPromise({
								try: () =>
									getSignedUrl(client, command, {
										expiresIn: expiry,
									}),
								catch: (cause) =>
									new S3Error({ operation: "createUploadUrls", cause }),
							}).pipe(
								Effect.map((url) => ({
									signedUrl: url,
									file: {
										objectKey: id,
										objectMetadata: { id },
										name: file.name,
										size: file.size,
										type: file.type,
									},
								})),
							);
						}),
					{ concurrency: 10 },
				);
			}).pipe(Effect.map((presignedUrls) => ({ data: presignedUrls }))),
		),
);

export const createDownloadUrl = authed.storage.createDownloadUrl.handler(
	async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const { client } = yield* S3Service;

				const expiry = 60 * 60;
				const extension = getFileTypeFromMime(input.fileType);
				const filePath = `${input.prefix}/${input.id}.${extension}`;

				const command = new GetObjectCommand({
					Bucket: input.bucket,
					Key: filePath,
				});

				return yield* Effect.tryPromise({
					try: () =>
						getSignedUrl(client, command, {
							expiresIn: expiry,
						}),
					catch: (cause) =>
						new S3Error({ operation: "createDownloadUrl", cause }),
				}).pipe(Effect.map((presignedUrl) => ({ url: presignedUrl })));
			}),
		),
);
