import {
	GetObjectCommand,
	PutObjectCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as Effect from "effect/Effect";
import { S3Error } from "./errors";
import { S3Service } from "./service";

const signWithClient = (params: {
	sign: () => Promise<string>;
	operation: string;
}) =>
	Effect.tryPromise({
		try: params.sign,
		catch: (cause) =>
			new S3Error({
				operation: params.operation,
				cause,
			}),
	});

export const getSignedUploadUrl = (params: {
	bucket: string;
	key: string;
	contentType: string;
	contentLength: number;
	expiresIn?: number;
}) =>
	Effect.gen(function* () {
		const { presignClient } = yield* S3Service;
		const command = new PutObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
			ContentType: params.contentType,
			ContentLength: params.contentLength,
		});

		return yield* signWithClient({
			sign: () =>
				getSignedUrl(presignClient, command, {
					expiresIn: params.expiresIn ?? 3600,
				}),
			operation: "getSignedUploadUrl",
		});
	});

export const getDownloadUrl = (params: {
	bucket: string;
	key: string;
	expiresIn?: number;
	endpointMode?: "public" | "internal";
}) =>
	Effect.gen(function* () {
		const { client, presignClient } = yield* S3Service;
		const selectedClient =
			params.endpointMode === "internal" ? client : presignClient;

		const command = new GetObjectCommand({
			Bucket: params.bucket,
			Key: params.key,
		});

		return yield* signWithClient({
			sign: () =>
				getSignedUrl(selectedClient, command, {
					expiresIn: params.expiresIn ?? 3600,
				}),
			operation: "getDownloadUrl",
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
		const { presignClient } = yield* S3Service;
		const command = new UploadPartCommand({
			Bucket: params.bucket,
			Key: params.key,
			UploadId: params.uploadId,
			PartNumber: params.partNumber,
			ContentLength: params.contentLength,
		});

		return yield* signWithClient({
			sign: () =>
				getSignedUrl(presignClient, command, {
					expiresIn: params.expiresIn ?? 3600,
				}),
			operation: "getSignedPartUploadUrl",
		});
	});
