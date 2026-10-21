import { buckets } from "@orcai/core";
import { DB } from "@orcai/db";
import {
	buildUploadPrefix,
	ensureQuotedEtag,
	getFileTypeFromMime,
	isMimeAllowed,
	shouldUseMultipartUpload,
	UPLOAD_ROUTES,
} from "@orcai/s3";
import {
	createBucketIfNotExists,
	getDownloadUrl,
	getSignedPartUploadUrl,
	getSignedUploadUrl,
	normalizeUploadId,
	sendAbortMultipartUploadCommand,
	sendCompleteMultipartUploadCommand,
	sendCreateMultipartUploadCommand,
	validateUploadEnvelope,
} from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";

const createUploadUrls = authed.storage.createUploadUrls.effect(function* ({
	input,
	context,
}) {
	const uploadRoute = UPLOAD_ROUTES[input.route];

	if (input.files.length > uploadRoute.maxFiles) {
		return yield* Effect.fail(
			new AppErrors.BadRequestError({
				reason: "UPLOAD_TOO_MANY_FILES",
				params: {
					maxFiles: uploadRoute.maxFiles,
				},
				message: `Too many files. Max allowed: ${uploadRoute.maxFiles}.`,
			}),
		);
	}

	yield* Effect.forEach(input.files, (file) =>
		Effect.gen(function* () {
			if (file.size > uploadRoute.maxFileSize) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "UPLOAD_FILE_TOO_LARGE",
						params: {
							fileName: file.name,
						},
						message: `File "${file.name}" exceeds max allowed size.`,
					}),
				);
			}

			if (
				!isMimeAllowed({
					mimeType: file.type,
					allowedMimePatterns: uploadRoute.allowedMimePatterns,
				})
			) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "UPLOAD_FILE_TYPE_INVALID",
						params: {
							fileName: file.name,
							fileType: file.type,
						},
						message: `File type "${file.type}" is not allowed.`,
					}),
				);
			}
		}),
	);

	const bucket = uploadRoute.bucket;
	const prefix = buildUploadPrefix({
		userId: context.auth.user.id,
		route: input.route,
	});

	yield* createBucketIfNotExists(bucket);

	const presignedUrls = yield* Effect.forEach(
		input.files,
		(file) =>
			Effect.gen(function* () {
				const id = uuidv4();
				const extension = getFileTypeFromMime(file.type);
				const filePath = `${prefix}/${id}.${extension}`;
				const objectMetadata = {
					...input.metadata,
					id,
					prefix,
					key: filePath,
					route: input.route,
					userId: context.auth.user.id,
					bucket,
				};

				const useMultipart = shouldUseMultipartUpload({
					route: input.route,
					fileSize: file.size,
				});

				if (!useMultipart) {
					return yield* getSignedUploadUrl({
						bucket,
						key: filePath,
						contentType: file.type,
						contentLength: file.size,
						expiresIn: uploadRoute.signedUrlExpiresIn,
					}).pipe(
						Effect.map((url) => ({
							mode: "single" as const,
							signedUrl: url,
							headers: {
								"Content-Type": file.type,
							},
							file: {
								objectKey: id,
								objectMetadata,
								name: file.name,
								size: file.size,
								type: file.type,
							},
						})),
					);
				}

				const multipartConfig = uploadRoute.multipart;
				const partSize = multipartConfig.partSize;
				const totalParts = Math.ceil(file.size / partSize);

				if (totalParts > 10_000) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "UPLOAD_FILE_TOO_LARGE",
							params: {
								fileName: file.name,
							},
							message: `File "${file.name}" has too many multipart chunks.`,
						}),
					);
				}

				const multipartUpload = yield* sendCreateMultipartUploadCommand({
					bucket,
					key: filePath,
					contentType: file.type,
					metadata: objectMetadata,
				});

				const uploadId = multipartUpload.UploadId
					? normalizeUploadId(multipartUpload.UploadId)
					: undefined;

				if (!uploadId) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "UPLOAD_INIT_FAILED",
							message: "Failed to initialize multipart upload. Please retry.",
						}),
					);
				}

				const parts = yield* Effect.forEach(
					Array.from(
						{
							length: totalParts,
						},
						(_, index) => index + 1,
					),
					(partNumber) =>
						Effect.gen(function* () {
							const start = (partNumber - 1) * partSize;
							const size = Math.min(partSize, file.size - start);

							const signedUrl = yield* getSignedPartUploadUrl({
								bucket,
								key: filePath,
								uploadId,
								partNumber,
								contentLength: size,
								expiresIn: multipartConfig.partSignedUrlExpiresIn,
							});

							return {
								signedUrl,
								partNumber,
								size,
							};
						}),
					{
						concurrency: 10,
					},
				);

				return {
					mode: "multipart" as const,
					parts,
					partSize,
					uploadId,
					file: {
						objectKey: id,
						objectMetadata,
						name: file.name,
						size: file.size,
						type: file.type,
					},
				};
			}),
		{
			concurrency: 10,
		},
	);

	return {
		data: presignedUrls,
		metadata: {
			route: input.route,
			prefix,
			bucket,
		},
	};
});

const createDownloadUrl = authed.storage.createDownloadUrl
	.use(
		requireEntityPermission("asset", "download", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const expiry = 60 * 60;
		const asset = yield* db.query.asset
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
				columns: {
					bucket: true,
					prefix: true,
					fileType: true,
				},
			})
			.pipe(
				Effect.flatMap((row) =>
					Effect.fromNullishOr(row).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "ASSET_NOT_FOUND",
									message: "Asset not found",
								}),
						),
					),
				),
			);
		const filePath = (() => {
			if (!input.objectKey) {
				return `${asset.prefix}/${input.id}.${asset.fileType}`;
			}

			const processedAssetPrefix = `${input.id}/`;
			if (!input.objectKey.startsWith(processedAssetPrefix)) {
				return undefined;
			}

			return input.objectKey;
		})();

		if (!filePath) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "UPLOAD_REQUEST_INVALID",
					message: "Object key must belong to the requested asset.",
				}),
			);
		}

		return yield* getDownloadUrl({
			bucket: input.objectKey ? buckets.processed.name : asset.bucket,
			key: filePath,
			expiresIn: expiry,
		}).pipe(
			Effect.map((presignedUrl) => ({
				url: presignedUrl,
			})),
		);
	});

const completeMultipartUpload = authed.storage.completeMultipartUpload.effect(
	function* ({ input, context }) {
		const uploadId = normalizeUploadId(input.uploadId);

		if (!uploadId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "UPLOAD_REQUEST_INVALID",
					message: "Multipart upload ID is missing.",
				}),
			);
		}

		const validated = yield* validateUploadEnvelope({
			file: input.file,
			route: input.route,
			userId: context.auth.user.id,
		}).pipe(
			Effect.mapError(
				() =>
					new AppErrors.BadRequestError({
						reason: "UPLOAD_REQUEST_INVALID",
						message: "Invalid upload metadata.",
					}),
			),
		);

		const sortedParts = [
			...input.parts,
		]
			.sort((a, b) => a.partNumber - b.partNumber)
			.map((part) => ({
				ETag: ensureQuotedEtag(part.etag),
				PartNumber: part.partNumber,
			}));

		yield* sendCompleteMultipartUploadCommand({
			bucket: validated.bucket,
			key: validated.stagingKey,
			uploadId,
			parts: sortedParts,
		});

		return {
			ok: true,
		};
	},
);

const abortMultipartUpload = authed.storage.abortMultipartUpload.effect(
	function* ({ input, context }) {
		const uploadId = normalizeUploadId(input.uploadId);

		if (!uploadId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "UPLOAD_REQUEST_INVALID",
					message: "Multipart upload ID is missing.",
				}),
			);
		}

		const validated = yield* validateUploadEnvelope({
			file: input.file,
			route: input.route,
			userId: context.auth.user.id,
		}).pipe(
			Effect.mapError(
				() =>
					new AppErrors.BadRequestError({
						reason: "UPLOAD_REQUEST_INVALID",
						message: "Invalid upload metadata.",
					}),
			),
		);

		yield* sendAbortMultipartUploadCommand({
			bucket: validated.bucket,
			key: validated.stagingKey,
			uploadId,
		});

		return {
			ok: true,
		};
	},
);

export const storageRouter = {
	createUploadUrls,
	createDownloadUrl,
	completeMultipartUpload,
	abortMultipartUpload,
};
