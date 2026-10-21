import { buckets } from "@orcai/core";
import type { BucketName } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { getFileTypeFromMime } from "../shared/file-type-helpers";
import {
	UPLOAD_ROUTES,
	UPLOAD_STAGING_PREFIX,
	type UploadRouteName,
} from "../shared/upload-policy";
import { sendCreateBucketCommand, sendHeadBucketCommand } from "./commands";
import { getS3Code, getS3StatusCode, S3Error } from "./errors";

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

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidEnvelope = (cause: string) =>
	new S3Error({
		operation: "validateUploadEnvelope",
		cause,
	});

/**
 * Checks a signed upload's metadata against the caller and the route, and
 * derives the staged object's key and the final prefix and key of its asset.
 */
export const validateUploadEnvelope = (params: {
	file: {
		type: string;
		objectMetadata: Record<string, string>;
	};
	route: UploadRouteName;
	userId: string;
}) =>
	Effect.gen(function* () {
		const { id, prefix, route, userId, bucket, key } =
			params.file.objectMetadata;

		if (!id || !prefix || !route || !userId || !bucket || !key) {
			return yield* invalidEnvelope("incomplete_metadata");
		}

		if (route !== params.route) {
			return yield* invalidEnvelope("route_metadata_mismatch");
		}

		if (userId !== params.userId) {
			return yield* invalidEnvelope("user_metadata_mismatch");
		}

		const expectedBucket = UPLOAD_ROUTES[params.route].bucket;
		if (bucket !== expectedBucket) {
			return yield* invalidEnvelope("bucket_metadata_mismatch");
		}

		if (!UUID_PATTERN.test(id)) {
			return yield* invalidEnvelope("invalid_id_metadata");
		}

		const finalPrefix = prefix.startsWith(UPLOAD_STAGING_PREFIX)
			? prefix.slice(UPLOAD_STAGING_PREFIX.length)
			: undefined;
		const [scope, prefixUserId, prefixRoute, year, month, ...rest] =
			finalPrefix?.split("/") ?? [];

		const isValidPrefix =
			rest.length === 0 &&
			scope === "users" &&
			prefixUserId === params.userId &&
			prefixRoute === params.route &&
			/^\d{4}$/.test(year ?? "") &&
			/^(0[1-9]|1[0-2])$/.test(month ?? "");

		if (!finalPrefix || !isValidPrefix) {
			return yield* invalidEnvelope("invalid_prefix_metadata");
		}

		const extension = getFileTypeFromMime(params.file.type);
		const stagingKey = `${prefix}/${id}.${extension}`;

		if (key !== stagingKey) {
			return yield* invalidEnvelope("key_metadata_mismatch");
		}

		return {
			id,
			bucket: expectedBucket,
			stagingKey,
			prefix: finalPrefix,
			key: `${finalPrefix}/${id}.${extension}`,
		};
	});

export const normalizeUploadId = (uploadId: string) =>
	uploadId.trim().replace(/^"+|"+$/g, "");
