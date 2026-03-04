import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateBucketCommand,
	CreateMultipartUploadCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import * as Effect from "effect/Effect";
import { S3Service } from "@/lib/effect/services/s3";
import { mapS3CauseToAppError } from "@/lib/effect/utils/errors";

export const sendCreateMultipartUploadCommand = (params: {
	bucket: string;
	key: string;
	contentType: string;
	metadata: Record<string, string>;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new CreateMultipartUploadCommand({
			Bucket: params.bucket,
			Key: params.key,
			ContentType: params.contentType,
			Metadata: params.metadata,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendCreateMultipartUploadCommand",
					cause,
				}),
		});
	});

export const sendCompleteMultipartUploadCommand = (params: {
	bucket: string;
	key: string;
	uploadId: string;
	parts: {
		ETag: string;
		PartNumber: number;
	}[];
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new CompleteMultipartUploadCommand({
			Bucket: params.bucket,
			Key: params.key,
			UploadId: params.uploadId,
			MultipartUpload: {
				Parts: params.parts,
			},
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendCompleteMultipartUploadCommand",
					cause,
				}),
		});
	});

export const sendAbortMultipartUploadCommand = (params: {
	bucket: string;
	key: string;
	uploadId: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new AbortMultipartUploadCommand({
			Bucket: params.bucket,
			Key: params.key,
			UploadId: params.uploadId,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendAbortMultipartUploadCommand",
					cause,
				}),
		});
	});

export const sendHeadObjectCommand = (params: {
	bucket: string;
	key: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new HeadObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendHeadObjectCommand",
					cause,
					notFoundAs: "bad_request",
				}),
		});
	});

export const sendHeadBucketCommand = (params: { bucket: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new HeadBucketCommand({
			Bucket: params.bucket,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendHeadBucketCommand",
					cause,
				}),
		});
	});

export const sendCreateBucketCommand = (params: { bucket: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new CreateBucketCommand({
			Bucket: params.bucket,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendCreateBucketCommand",
					cause,
				}),
		});
	});

export const sendPutObjectCommand = (params: {
	bucket: string;
	key: string;
	body: Buffer | ReadableStream | Blob | string;
	contentType: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new PutObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
			Body: params.body,
			ContentType: params.contentType,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendPutObjectCommand",
					cause,
				}),
		});
	});

export const sendListObjectsCommand = (params: {
	bucket: string;
	prefix: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new ListObjectsV2Command({
			Bucket: params.bucket,
			Prefix: params.prefix,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendListObjectsCommand",
					cause,
				}),
		});
	});

export const sendDeleteObjectCommand = (params: {
	bucket: string;
	key: string;
}) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new DeleteObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendDeleteObjectCommand",
					cause,
				}),
		});
	});

export const sendGetObjectCommand = (params: { bucket: string; key: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;

		const command = new GetObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* Effect.tryPromise({
			try: () => client.send(command),
			catch: (cause) =>
				mapS3CauseToAppError({
					operation: "sendGetObjectCommand",
					cause,
				}),
		});
	});
