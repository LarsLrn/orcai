import { logErrorCause } from "@orcai/observability";
import type { ErrorReasonProps } from "@orcai/schema";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { assetObjectKey } from "../shared/asset-keys";
import { fileTypeAmong } from "../shared/file-types";
import {
	UPLOAD_ROUTES,
	UPLOAD_STAGING_PREFIX,
	type UploadRouteName,
} from "../shared/upload-policy";
import {
	sendCopyObjectCommand,
	sendDeleteObjectCommand,
	sendHeadObjectCommand,
} from "./commands";
import { isS3NotFound } from "./errors";

/** An upload a route refuses, with the reason the client translates. */
export class UploadRejected extends Data.TaggedError("UploadRejected")<{
	readonly rejection: ErrorReasonProps;
}> {}

const reject = (rejection: ErrorReasonProps) =>
	Effect.fail(
		new UploadRejected({
			rejection,
		}),
	);

type RouteFileType<R extends UploadRouteName> =
	(typeof UPLOAD_ROUTES)[R]["fileTypes"][number];

/** The file type a route stores a file as, refusing a type or size the route does not take. */
export const checkUploadFile = <R extends UploadRouteName>(
	route: R,
	file: {
		name: string;
		type: string;
		size: number;
	},
) =>
	Effect.gen(function* () {
		const policy = UPLOAD_ROUTES[route];
		const fileType = fileTypeAmong<RouteFileType<R>>(
			file.type,
			policy.fileTypes as readonly RouteFileType<R>[],
		);
		if (!fileType) {
			return yield* reject({
				reason: "UPLOAD_FILE_TYPE_INVALID",
				params: {
					fileName: file.name,
					fileType: file.type,
				},
			});
		}
		if (file.size > policy.maxFileSize) {
			return yield* reject({
				reason: "UPLOAD_FILE_TOO_LARGE",
				params: {
					fileName: file.name,
				},
			});
		}
		return fileType;
	});

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidRequest = reject({
	reason: "UPLOAD_REQUEST_INVALID",
});

/** The final prefix of a staging prefix the caller may use for this route. */
const finalPrefixOf = (
	prefix: string,
	route: UploadRouteName,
	userId: string,
) => {
	if (!prefix.startsWith(UPLOAD_STAGING_PREFIX)) return undefined;
	const finalPrefix = prefix.slice(UPLOAD_STAGING_PREFIX.length);
	const [scope, prefixUserId, prefixRoute, year, month, ...rest] =
		finalPrefix.split("/");
	return rest.length === 0 &&
		scope === "users" &&
		prefixUserId === userId &&
		prefixRoute === route &&
		/^\d{4}$/.test(year ?? "") &&
		/^(0[1-9]|1[0-2])$/.test(month ?? "")
		? finalPrefix
		: undefined;
};

/**
 * Checks a signed upload against the caller and the route: its metadata,
 * type and declared size. Answers where it is staged and where its asset goes.
 */
export const checkUpload = <R extends UploadRouteName>(params: {
	file: {
		name: string;
		type: string;
		size: number;
		objectMetadata: Record<string, string>;
	};
	route: R;
	userId: string;
}) =>
	Effect.gen(function* () {
		const { id, prefix, route, userId, bucket, key } =
			params.file.objectMetadata;
		const expectedBucket = UPLOAD_ROUTES[params.route].bucket;
		const finalPrefix = prefix
			? finalPrefixOf(prefix, params.route, params.userId)
			: undefined;
		if (
			!id ||
			!UUID_PATTERN.test(id) ||
			!prefix ||
			!finalPrefix ||
			route !== params.route ||
			userId !== params.userId ||
			bucket !== expectedBucket
		) {
			return yield* invalidRequest;
		}

		const fileType = yield* checkUploadFile(params.route, params.file);
		const stagingKey = assetObjectKey({
			prefix,
			id,
			fileType,
		});
		if (key !== stagingKey) {
			return yield* invalidRequest;
		}

		return {
			id,
			bucket: expectedBucket,
			fileType,
			stagingKey,
			prefix: finalPrefix,
			key: assetObjectKey({
				prefix: finalPrefix,
				id,
				fileType,
			}),
			name: params.file.name,
			type: params.file.type,
			size: params.file.size,
		};
	});

type CheckedUpload = Effect.Success<ReturnType<typeof checkUpload>>;

/**
 * Moves a checked upload's staged object to `key` once storage confirms it
 * exists with the declared type and length, then runs `commit`. The staged
 * object is deleted after `commit` succeeds; the lifecycle rule expires one
 * left behind.
 */
export const claimStagedUpload = <A, E, R>(
	upload: CheckedUpload,
	params: {
		key: string;
		commit: Effect.Effect<A, E, R>;
	},
) =>
	Effect.gen(function* () {
		const staged = yield* sendHeadObjectCommand({
			bucket: upload.bucket,
			key: upload.stagingKey,
		}).pipe(
			Effect.catchIf(isS3NotFound, () =>
				reject({
					reason: "UPLOAD_FILE_MISSING",
				}),
			),
		);
		if (staged.ContentType !== upload.type) {
			return yield* reject({
				reason: "UPLOAD_FILE_TYPE_INVALID",
				params: {
					fileName: upload.name,
					fileType: staged.ContentType ?? "",
				},
			});
		}
		if (staged.ContentLength !== upload.size) {
			return yield* reject({
				reason: "UPLOAD_FILE_SIZE_MISMATCH",
			});
		}

		yield* sendCopyObjectCommand({
			bucket: upload.bucket,
			sourceKey: upload.stagingKey,
			key: params.key,
		});
		const committed = yield* params.commit;

		yield* sendDeleteObjectCommand({
			bucket: upload.bucket,
			key: upload.stagingKey,
		}).pipe(
			Effect.catchCause((cause) =>
				logErrorCause("Staged upload not deleted", cause),
			),
		);
		return committed;
	});

export const normalizeUploadId = (uploadId: string) =>
	uploadId.trim().replace(/^"+|"+$/g, "");
