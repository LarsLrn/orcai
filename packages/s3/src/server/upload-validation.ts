import { buckets } from "@orcai/core";
import type { BucketName } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { getFileTypeFromMime } from "../shared/file-type-helpers";
import type { UploadRouteName } from "../shared/upload-policy";
import { sendCreateBucketCommand, sendHeadBucketCommand } from "./commands";
import { S3Error } from "./errors";

type S3LikeCause = {
	name?: string;
	code?: string;
	Code?: string;
	$metadata?: {
		httpStatusCode?: number;
	};
};

const isS3LikeCause = (cause: unknown): cause is S3LikeCause =>
	cause !== null && typeof cause === "object";

const getS3StatusCode = (cause: unknown) =>
	isS3LikeCause(cause) ? cause.$metadata?.httpStatusCode : undefined;

const getS3Code = (cause: unknown) => {
	if (!isS3LikeCause(cause)) {
		return undefined;
	}

	if (typeof cause.Code === "string") {
		return cause.Code;
	}

	if (typeof cause.code === "string") {
		return cause.code;
	}

	if (typeof cause.name === "string") {
		return cause.name;
	}

	return undefined;
};

const isBucketNotFound = (cause: unknown) => {
	const statusCode = getS3StatusCode(cause);
	const code = getS3Code(cause);
	return statusCode === 404 || code === "NotFound" || code === "NoSuchBucket";
};

const isBucketConflict = (cause: unknown) => {
	const statusCode = getS3StatusCode(cause);
	const code = getS3Code(cause);
	return (
		statusCode === 409 ||
		code === "Conflict" ||
		code === "BucketAlreadyExists" ||
		code === "BucketAlreadyOwnedByYou"
	);
};

export const createBucketIfNotExists = (bucketName: BucketName) =>
	Effect.gen(function* () {
		const allowedBuckets = Object.values(buckets).map((bucket) => bucket.name);

		if (!allowedBuckets.includes(bucketName)) {
			return yield* new S3Error({
				operation: "createBucketIfNotExists",
				cause: "forbidden_bucket",
			});
		}

		return yield* sendHeadBucketCommand({
			bucket: bucketName,
		}).pipe(
			Effect.catchTag("S3Error", (error) =>
				isBucketNotFound(error.cause)
					? sendCreateBucketCommand({
							bucket: bucketName,
						}).pipe(
							Effect.catchTag("S3Error", (createError) =>
								isBucketConflict(createError.cause)
									? Effect.void
									: Effect.fail(createError),
							),
						)
					: Effect.fail(error),
			),
		);
	});

export const validateUploadEnvelope = (params: {
	file: {
		type: string;
		objectMetadata: Record<string, string>;
	};
	inputRoute: UploadRouteName;
	authUserId: string;
	expectedBucket: BucketName;
	requireKey?: boolean;
}) =>
	Effect.gen(function* () {
		const { id, prefix, route, userId, bucket, key } =
			params.file.objectMetadata;

		if (
			!id ||
			!prefix ||
			!route ||
			!userId ||
			!bucket ||
			(params.requireKey && !key)
		) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "incomplete_metadata",
			});
		}

		if (route !== params.inputRoute) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "route_metadata_mismatch",
			});
		}

		if (userId !== params.authUserId) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "user_metadata_mismatch",
			});
		}

		if (bucket !== params.expectedBucket) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "bucket_metadata_mismatch",
			});
		}

		const prefixSegments = prefix.split("/");
		const [scope, prefixUserId, prefixRoute, year, month] = prefixSegments;

		const isValidPrefix =
			prefixSegments.length === 5 &&
			scope === "users" &&
			prefixUserId === params.authUserId &&
			prefixRoute === params.inputRoute &&
			/^\d{4}$/.test(year ?? "") &&
			/^(0[1-9]|1[0-2])$/.test(month ?? "");

		if (!isValidPrefix) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "invalid_prefix_metadata",
			});
		}

		const extension = getFileTypeFromMime(params.file.type);
		const expectedKey = `${prefix}/${id}.${extension}`;

		if (params.requireKey && key !== expectedKey) {
			return yield* new S3Error({
				operation: "validateUploadEnvelope",
				cause: "key_metadata_mismatch",
			});
		}

		return {
			id,
			prefix,
			bucket: params.expectedBucket,
			expectedKey,
		};
	});

export const normalizeUploadId = (uploadId: string) =>
	uploadId.trim().replace(/^"+|"+$/g, "");
