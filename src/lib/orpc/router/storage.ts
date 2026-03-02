import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { dbSchema } from "@/db/schema";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	buildUploadPrefix,
	isMimeAllowed,
	shouldUseMultipartUpload,
	UPLOAD_ROUTES,
} from "@/lib/s3/upload-routes";
import {
	sendAbortMultipartUploadCommand,
	sendCompleteMultipartUploadCommand,
	sendCreateMultipartUploadCommand,
	sendHeadObjectCommand,
} from "@/lib/s3/utils/commands";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import {
	getDownloadUrl,
	getSignedPartUploadUrl,
	getSignedUploadUrl,
} from "@/lib/s3/utils/url-helpers";
import {
	createBucketIfNotExists,
	ensureQuotedEtag,
	normalizeUploadId,
	validateUploadEnvelope,
} from "@/lib/s3/utils/utils";

export const createUploadUrls = authed.storage.createUploadUrls.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const uploadRoute = UPLOAD_ROUTES[input.route];

				if (input.files.length > uploadRoute.maxFiles) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: `Too many files. Max allowed: ${uploadRoute.maxFiles}.`,
							data: { type: "too_many_files" },
						}),
					);
				}

				yield* Effect.forEach(input.files, (file) =>
					Effect.gen(function* () {
						if (file.size > uploadRoute.maxFileSize) {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
									message: `File "${file.name}" exceeds max allowed size.`,
									data: { type: "file_too_large" },
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
									data: { type: "invalid_file_type" },
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
										data: { type: "file_too_large" },
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
										data: { type: "invalid_request" },
									}),
								);
							}

							const parts = yield* Effect.forEach(
								Array.from({ length: totalParts }, (_, index) => index + 1),
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
								{ concurrency: 10 },
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
					{ concurrency: 10 },
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
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const expiry = 60 * 60;
				const extension = getFileTypeFromMime(input.fileType);
				const filePath = `${input.prefix}/${input.id}.${extension}`;

				return yield* getDownloadUrl({
					bucket: input.bucket,
					key: filePath,
					expiresIn: expiry,
				}).pipe(Effect.map((presignedUrl) => ({ url: presignedUrl })));
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
								data: { type: "invalid_request" },
							}),
						);
					}

					const validated = yield* validateUploadEnvelope({
						file: input.file,
						inputRoute: input.route,
						authUserId: context.auth.user.id,
						expectedBucket: uploadRoute.bucket,
						requireKey: true,
					});

					const sortedParts = [...input.parts]
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

					return { ok: true };
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
							data: { type: "invalid_request" },
						}),
					);
				}

				const validated = yield* validateUploadEnvelope({
					file: input.file,
					inputRoute: input.route,
					authUserId: context.auth.user.id,
					expectedBucket: uploadRoute.bucket,
					requireKey: true,
				});

				yield* sendAbortMultipartUploadCommand({
					bucket: validated.bucket,
					key: validated.expectedKey,
					uploadId,
				});

				return { ok: true };
			}),
		),
);

export const finalizeUpload = authed.storage.finalizeUpload
	.use(requireOrganizationPermission("create_asset"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const uploadRoute = UPLOAD_ROUTES[input.route];

				const allIds = input.files.map((file) => file.objectMetadata.id);
				const existingAssets = allIds.length
					? yield* db
							.select({
								id: dbSchema.asset.id,
								userId: dbSchema.asset.userId,
							})
							.from(dbSchema.asset)
							.where(inArray(dbSchema.asset.id, allIds))
					: [];

				const existingById = new Map(
					existingAssets.map((asset) => [asset.id, asset]),
				);

				const results = yield* Effect.forEach(
					input.files,
					(file) =>
						Effect.gen(function* () {
							const validated = yield* validateUploadEnvelope({
								file,
								inputRoute: input.route,
								authUserId: context.auth.user.id,
								expectedBucket: uploadRoute.bucket,
							});

							const headObject = yield* sendHeadObjectCommand({
								bucket: validated.bucket,
								key: validated.expectedKey,
							});

							if (
								typeof headObject.ContentLength === "number" &&
								headObject.ContentLength !== file.size
							) {
								return yield* Effect.fail(
									errors.BAD_REQUEST({
										message: "Uploaded file size mismatch.",
										data: { type: "invalid_request" },
									}),
								);
							}

							const existing = existingById.get(validated.id);

							if (existing) {
								if (existing.userId !== context.auth.user.id) {
									return yield* Effect.fail(
										errors.BAD_REQUEST({
											message:
												"Asset already exists and belongs to another user.",
											data: { type: "rejected" },
										}),
									);
								}

								return { id: validated.id, created: false };
							}

							yield* db.insert(dbSchema.asset).values({
								id: validated.id,
								title: file.name || "New Asset",
								size: file.size,
								fileType: file.type,
								bucket: validated.bucket,
								prefix: validated.prefix,
								userId: context.auth.user.id,
							});

							yield* initializeResourceAuthorization({
								resourceType: "asset",
								resourceId: validated.id,
								organizationId: context.auth.session.activeOrganizationId,
								ownerUserId: context.auth.user.id,
							});

							return { id: validated.id, created: true };
						}),
					{ concurrency: 10 },
				);

				return { data: results };
			}),
		),
	);
