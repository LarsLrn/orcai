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
import { S3Error } from "./errors";
import { S3Service } from "./service";

const trySend = <A>(params: { send: () => Promise<A>; operation: string }) =>
	Effect.tryPromise({
		try: params.send,
		catch: (cause) =>
			new S3Error({
				operation: params.operation,
				cause,
			}),
	});

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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendCreateMultipartUploadCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendCompleteMultipartUploadCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendAbortMultipartUploadCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendHeadObjectCommand",
		});
	});

export const sendHeadBucketCommand = (params: { bucket: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;
		const command = new HeadBucketCommand({
			Bucket: params.bucket,
		});

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendHeadBucketCommand",
		});
	});

export const sendCreateBucketCommand = (params: { bucket: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;
		const command = new CreateBucketCommand({
			Bucket: params.bucket,
		});

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendCreateBucketCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendPutObjectCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendListObjectsCommand",
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

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendDeleteObjectCommand",
		});
	});

export const sendGetObjectCommand = (params: { bucket: string; key: string }) =>
	Effect.gen(function* () {
		const { client } = yield* S3Service;
		const command = new GetObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* trySend({
			send: () => client.send(command),
			operation: "sendGetObjectCommand",
		});
	});
