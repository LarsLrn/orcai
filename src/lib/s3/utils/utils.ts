import * as Effect from "effect/Effect";
import { BadRequestError, S3Error } from "@/lib/effect/utils/errors";
import type { UploadRouteName } from "@/lib/s3/upload-routes";
import { buckets } from "@/settings/buckets";
import { sendCreateBucketCommand, sendHeadBucketCommand } from "./commands";
import { getFileTypeFromMime } from "./file-type-helpers";

export const createBucketIfNotExists = (bucketName: string) =>
	Effect.gen(function* () {
		// TODO: Add this to an initialization script or migration instead of checking every time

		const allowedBuckets = Object.values(buckets).map((b) => b.name);

		if (!allowedBuckets.includes(bucketName)) {
			return yield* new S3Error({
				operation: "createBucketIfNotExists",
				cause: "forbidden_bucket",
			});
		}

		return yield* sendHeadBucketCommand({
			bucket: bucketName,
		}).pipe(
			Effect.catchTag("NotFoundError", () =>
				sendCreateBucketCommand({
					bucket: bucketName,
				}).pipe(
					// Another request may have created the bucket in between.
					Effect.catchTag("ConflictError", () => Effect.void),
				),
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
	expectedBucket: string;
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
			return yield* new BadRequestError({
				message: "Upload metadata is incomplete.",
			});
		}

		if (route !== params.inputRoute) {
			return yield* new BadRequestError({
				message: "Upload route metadata mismatch.",
			});
		}

		if (userId !== params.authUserId) {
			return yield* new BadRequestError({
				message: "Upload user metadata mismatch.",
			});
		}

		if (bucket !== params.expectedBucket) {
			return yield* new BadRequestError({
				message: "Upload bucket metadata mismatch.",
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
			return yield* new BadRequestError({
				message: "Upload prefix metadata is invalid.",
			});
		}

		const extension = getFileTypeFromMime(params.file.type);
		const expectedKey = `${prefix}/${id}.${extension}`;

		if (params.requireKey && key !== expectedKey) {
			return yield* new BadRequestError({
				message: "Upload key metadata mismatch.",
			});
		}

		return {
			id,
			prefix,
			bucket,
			expectedKey,
		};
	});

export const normalizeUploadId = (uploadId: string) =>
	uploadId.trim().replace(/^"+|"+$/g, "");

export const ensureQuotedEtag = (etag: string) => {
	const trimmed = etag.trim();

	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed;
	}

	return `"${trimmed.replace(/"/g, "")}"`;
};
