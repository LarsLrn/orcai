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
	sendHeadObjectCommand,
	validateUploadEnvelope,
} from "@orcai/s3/server";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";

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

const isS3NotFound = (cause: unknown) => {
	const statusCode = getS3StatusCode(cause);
	const code = getS3Code(cause);
	return (
		statusCode === 404 ||
		code === "NotFound" ||
		code === "NoSuchKey" ||
		code === "NoSuchUpload" ||
		code === "NoSuchBucket"
	);
};

export const createUploadUrls = authed.storage.createUploadUrls.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const uploadRoute = UPLOAD_ROUTES[input.route];

				if (input.files.length > uploadRoute.maxFiles) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: `Too many files. Max allowed: ${uploadRoute.maxFiles}.`,
							data: {
								type: "too_many_files",
							},
						}),
					);
				}

				yield* Effect.forEach(input.files, (file) =>
					Effect.gen(function* () {
						if (file.size > uploadRoute.maxFileSize) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message: `File "${file.name}" exceeds max allowed size.`,
									data: {
										type: "file_too_large",
									},
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
								errors.BAD_REQUEST({
									message: `File type "${file.type}" is not allowed.`,
									data: {
										type: "invalid_file_type",
									},
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
									errors.BAD_REQUEST({
										message: `File "${file.name}" has too many multipart chunks.`,
										data: {
											type: "file_too_large",
										},
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
									errors.BAD_REQUEST({
										message:
											"Failed to initialize multipart upload. Please retry.",
										data: {
											type: "invalid_request",
										},
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
			}),
		),
);

export const createDownloadUrl = authed.storage.createDownloadUrl
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "download",
				entityType: "asset",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const expiry = 60 * 60;
				const asset = yield* db.query.asset
					.findFirst({
						where: {
							id: input.id,
						},
						columns: {
							bucket: true,
							prefix: true,
							fileType: true,
						},
					})
					.pipe(
						Effect.flatMap((row) =>
							Effect.fromNullable(row).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "Asset not found",
										}),
									),
								),
							),
						),
					);
				const filePath = (() => {
					if (!input.objectKey) {
						const extension = getFileTypeFromMime(asset.fileType);
						return `${asset.prefix}/${input.id}.${extension}`;
					}

					const processedAssetPrefix = `${input.id}/`;
					if (!input.objectKey.startsWith(processedAssetPrefix)) {
						return undefined;
					}

					return input.objectKey;
				})();

				if (!filePath) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "Object key must belong to the requested asset.",
							data: {
								type: "invalid_request",
							},
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
			}),
		),
	);

export const completeMultipartUpload =
	authed.storage.completeMultipartUpload.handler(
		async ({ input, context, errors }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const uploadRoute = UPLOAD_ROUTES[input.route];
					const uploadId = normalizeUploadId(input.uploadId);

					if (!uploadId) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "Multipart upload ID is missing.",
								data: {
									type: "invalid_request",
								},
							}),
						);
					}

					const validated = yield* validateUploadEnvelope({
						file: input.file,
						inputRoute: input.route,
						authUserId: context.auth.user.id,
						expectedBucket: uploadRoute.bucket,
						requireKey: true,
					}).pipe(
						Effect.mapError(() =>
							errors.BAD_REQUEST({
								message: "Invalid upload metadata.",
								data: {
									type: "invalid_request",
								},
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
						key: validated.expectedKey,
						uploadId,
						parts: sortedParts,
					});

					return {
						ok: true,
					};
				}),
			),
	);

export const abortMultipartUpload = authed.storage.abortMultipartUpload.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const uploadRoute = UPLOAD_ROUTES[input.route];
				const uploadId = normalizeUploadId(input.uploadId);

				if (!uploadId) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "Multipart upload ID is missing.",
							data: {
								type: "invalid_request",
							},
						}),
					);
				}

				const validated = yield* validateUploadEnvelope({
					file: input.file,
					inputRoute: input.route,
					authUserId: context.auth.user.id,
					expectedBucket: uploadRoute.bucket,
					requireKey: true,
				}).pipe(
					Effect.mapError(() =>
						errors.BAD_REQUEST({
							message: "Invalid upload metadata.",
							data: {
								type: "invalid_request",
							},
						}),
					),
				);

				yield* sendAbortMultipartUploadCommand({
					bucket: validated.bucket,
					key: validated.expectedKey,
					uploadId,
				});

				return {
					ok: true,
				};
			}),
		),
);

export const finalizeUpload = authed.storage.finalizeUpload
	.use(requireOrganizationPermission("create_asset"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const uploadRoute = UPLOAD_ROUTES[input.route];

				const results = yield* Effect.forEach(
					input.files,
					(file) =>
						Effect.gen(function* () {
							const validated = yield* validateUploadEnvelope({
								file,
								inputRoute: input.route,
								authUserId: context.auth.user.id,
								expectedBucket: uploadRoute.bucket,
							}).pipe(
								Effect.mapError(() =>
									errors.BAD_REQUEST({
										message: "Invalid upload metadata.",
										data: {
											type: "invalid_request",
										},
									}),
								),
							);

							const headObject = yield* sendHeadObjectCommand({
								bucket: validated.bucket,
								key: validated.expectedKey,
							}).pipe(
								Effect.mapError((error) =>
									isS3NotFound(error.cause)
										? errors.BAD_REQUEST({
												message: "Uploaded file not found in storage.",
												data: {
													type: "invalid_request",
												},
											})
										: error,
								),
							);

							if (
								typeof headObject.ContentLength === "number" &&
								headObject.ContentLength !== file.size
							) {
								return yield* Effect.fail(
									errors.BAD_REQUEST({
										message: "Uploaded file size mismatch.",
										data: {
											type: "invalid_request",
										},
									}),
								);
							}

							return {
								id: validated.id,
								bucket: validated.bucket,
								prefix: validated.prefix,
								objectKey: validated.expectedKey,
								name: file.name,
								size: file.size,
								type: file.type,
							};
						}),
					{
						concurrency: 10,
					},
				);

				return {
					data: results,
				};
			}),
		),
	);
