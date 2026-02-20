import {
	GetObjectCommand,
	PutObjectCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as Effect from "effect/Effect";
import { S3Service } from "@/lib/effect/services/s3";
import { mapS3CauseToAppError } from "@/lib/effect/utils/errors";

export const getSignedUploadUrl = (params: {
	bucket: string;
	key: string;
	contentType: string;
	contentLength: number;
	expiresIn?: number;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new PutObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
			ContentType: params.contentType,
			ContentLength: params.contentLength,
		});

		return yield* Effect.tryPromise({
			try: () =>
				getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 3600 }),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "getSignedUploadUrl",
					cause,
				}),
		});
	});

export const getDownloadUrl = (params: {
	bucket: string;
	key: string;
	expiresIn?: number;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new GetObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* Effect.tryPromise({
			try: () =>
				getSignedUrl(client, command, {
					expiresIn: params.expiresIn ?? 3600,
				}),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "getDownloadUrl",
					cause,
				}),
		});
	});

export const getSignedPartUploadUrl = (params: {
	bucket: string;
	key: string;
	uploadId: string;
	partNumber: number;
	contentLength: number;
	expiresIn?: number;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new UploadPartCommand({
			Bucket: params.bucket,
			Key: params.key,
			UploadId: params.uploadId,
			PartNumber: params.partNumber,
			ContentLength: params.contentLength,
		});

		return yield* Effect.tryPromise({
			try: () =>
				getSignedUrl(client, command, {
					expiresIn: params.expiresIn ?? 3600,
				}),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "getSignedPartUploadUrl",
					cause,
				}),
		});
	});
