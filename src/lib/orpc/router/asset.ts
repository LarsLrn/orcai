import { and, count, desc, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { dbSchema } from "@/db/schema";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { sendJobBatchEffect } from "@/lib/pg-boss/helpers";
import { PROCESS_ASSET_JOB_NAME } from "@/lib/pg-boss/schema/job-queues";
import { buildUploadPrefix } from "@/lib/s3/upload-routes";
import { sendDeleteObjectCommand } from "@/lib/s3/utils/commands";
import { deletePrefixRecursively } from "@/lib/s3/utils/file-functions";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import {
	checkEntityPermission,
	hasPermission,
	lookupEntitiesByPermission,
} from "@/lib/spice-db/client";
import { deletePointsByIdentifier } from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";

const createAssetRecordEffect = (params: {
	id?: string;
	title: string;
	size: number;
	fileType: string;
	bucket: string;
	prefix: string;
	metadata?: any;
	userId: string;
	organizationId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const assetId = params.id ?? uuidv4();

		const [asset] = yield* db
			.insert(dbSchema.asset)
			.values({
				id: assetId,
				title: params.title,
				size: params.size,
				fileType: params.fileType,
				bucket: params.bucket,
				prefix: params.prefix,
				metadata: params.metadata,
				userId: params.userId,
			})
			.returning();

		const relationResult = yield* initializeResourceAuthorization({
			resourceType: "asset",
			resourceId: asset.id,
			organizationId: params.organizationId,
			ownerUserId: params.userId,
		});

		return {
			asset,
			zedToken: relationResult.zedToken,
		};
	});

const dispatchProcessJob = (asset: {
	id: string;
	bucket: string;
	prefix: string;
	fileType: string;
}) =>
	sendJobBatchEffect({
		jobName: PROCESS_ASSET_JOB_NAME,
		jobs: [
			{
				data: {
					assetRef: {
						bucket: asset.bucket,
						prefix: asset.prefix,
						id: asset.id,
						type: getFileTypeFromMime(asset.fileType),
					},
				},
			},
		],
		resourceOptions: {
			resourceId: asset.id,
			resourceType: "asset",
		},
	});

export const listAssets = authed.asset.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const allowedIds = yield* lookupEntitiesByPermission({
					userId: context.auth.user.id,
					permission: "read",
					entityType: "asset",
					zedToken: input.zedToken,
				}).pipe(
					Effect.map((response) =>
						response.map((item) => item.resourceObjectId),
					),
				);

				const whereConditions = [
					inArray(dbSchema.asset.id, allowedIds),
				];

				if (input.filters?.ids) {
					whereConditions.push(inArray(dbSchema.asset.id, input.filters.ids));
				}

				if (input.filters?.search) {
					whereConditions.push(
						ilike(dbSchema.asset.title, `%${input.filters.search}%`),
					);
				}

				return yield* Effect.all(
					[
						db
							.select({
								...getColumns(dbSchema.asset),
							})
							.from(dbSchema.asset)
							.where(and(...whereConditions))
							.orderBy(desc(dbSchema.asset.createdAt))
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.asset)
							.where(and(...whereConditions)),
					],
					{
						concurrency: "unbounded",
					},
				).pipe(
					Effect.map(([data, [countResult]]) => ({
						data,
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findAsset = authed.asset.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "asset",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [query] = yield* db
					.select({
						...getColumns(dbSchema.asset),
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.id));

				if (!query) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Asset not found",
						}),
					);
				}

				return {
					data: query,
				};
			}),
		),
	);

export const createAsset = authed.asset.create
	.use(requireOrganizationPermission("create_asset"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const prefix = buildUploadPrefix({
					userId: context.auth.user.id,
					route: "asset",
				});

				const { asset, zedToken } = yield* createAssetRecordEffect({
					id: input.id,
					title: input.title ?? "New Asset",
					size: input.size,
					fileType: input.fileType,
					bucket: buckets.main.name,
					prefix,
					metadata: input.metadata,
					userId: context.auth.user.id,
					organizationId: context.auth.session.activeOrganizationId,
				});

				return {
					data: asset,
					meta: {
						zedToken,
					},
				};
			}),
		),
	);

export const saveAsset = authed.asset.save.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (input.id) {
					const permission = yield* checkEntityPermission({
						entityId: input.id,
						entityType: "asset",
						permission: "edit",
						userId: context.auth.user.id,
						zedToken: undefined,
					});

					if (!hasPermission(permission)) {
						return yield* Effect.fail(
							errors.FORBIDDEN({
								message: "You do not have permission to edit this asset.",
								data: {
									allowed: false,
								},
							}),
						);
					}

					const [asset] = yield* db
						.update(dbSchema.asset)
						.set({
							title: input.title,
							metadata: input.metadata,
							updatedAt: new Date(),
						})
						.where(eq(dbSchema.asset.id, input.id))
						.returning({
							...getColumns(dbSchema.asset),
						});

					return {
						data: asset,
					};
				}

				if (!input.upload) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"An uploaded file reference is required to create an asset.",
						}),
					);
				}

				const organizationId = context.auth.session.activeOrganizationId;

				if (!organizationId) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "An active organization is required to create assets.",
						}),
					);
				}

				const permission = yield* checkEntityPermission({
					entityId: organizationId,
					entityType: "organization",
					permission: "create_asset",
					userId: context.auth.user.id,
					zedToken: undefined,
				});

				if (!hasPermission(permission)) {
					return yield* Effect.fail(
						errors.FORBIDDEN({
							message: "You do not have permission to create assets.",
							data: {
								allowed: false,
							},
						}),
					);
				}

				const { asset, zedToken } = yield* createAssetRecordEffect({
					id: input.upload.id,
					title: input.title,
					size: input.upload.size,
					fileType: input.upload.type,
					bucket: input.upload.bucket,
					prefix: input.upload.prefix,
					metadata: input.metadata,
					userId: context.auth.user.id,
					organizationId,
				});

				yield* dispatchProcessJob(asset);

				return {
					data: asset,
					meta: {
						zedToken,
					},
				};
			}),
		),
);

export const saveManyAssets = authed.asset.saveMany
	.use(requireOrganizationPermission("create_asset"))
	.handler(async ({ input, errors, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const results = yield* Effect.forEach(
					input.assets,
					(assetInput) =>
						Effect.gen(function* () {
							if (assetInput.id) {
								const db = yield* DB;
								const [asset] = yield* db
									.update(dbSchema.asset)
									.set({
										title: assetInput.title,
										metadata: assetInput.metadata,
										updatedAt: new Date(),
									})
									.where(eq(dbSchema.asset.id, assetInput.id))
									.returning({
										...getColumns(dbSchema.asset),
									});

								return {
									asset,
									zedToken: undefined,
								};
							}

							if (!assetInput.upload) {
								return yield* Effect.fail(
									errors.BAD_REQUEST({
										message:
											"An uploaded file reference is required to create an asset.",
									}),
								);
							}

							return yield* createAssetRecordEffect({
								id: assetInput.upload.id,
								title: assetInput.title,
								size: assetInput.upload.size,
								fileType: assetInput.upload.type,
								bucket: assetInput.upload.bucket,
								prefix: assetInput.upload.prefix,
								metadata: assetInput.metadata,
								userId: context.auth.user.id,
								organizationId: context.auth.session.activeOrganizationId,
							}).pipe(Effect.tap((result) => dispatchProcessJob(result.asset)));
						}),
					{
						concurrency: 10,
					},
				);

				return {
					data: results.map((result) => result.asset),
					meta: {
						zedToken: results.find((result) => result.zedToken)?.zedToken,
					},
				};
			}),
		),
	);

export const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "asset",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (!context.allowedIds || context.allowedIds.length === 0) {
					return {
						success: true,
						message: "No assets to delete",
					};
				}

				const assetsToDelete = yield* db
					.select()
					.from(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				yield* Effect.all(
					assetsToDelete.map((asset) =>
						Effect.gen(function* () {
							const extension = getFileTypeFromMime(asset.fileType);

							yield* sendDeleteObjectCommand({
								bucket: asset.bucket,
								key: `${asset.prefix}/${asset.id}.${extension}`,
							});
							yield* deletePointsByIdentifier({
								assetId: asset.id,
								blockId: undefined,
							});
							yield* deletePrefixRecursively({
								bucket: buckets.processed.name,
								prefix: `${asset.id}/`,
							});
						}),
					),
					{
						concurrency: "unbounded",
					},
				);

				yield* db
					.delete(dbSchema.asset)
					.where(inArray(dbSchema.asset.id, context.allowedIds));

				return {
					success: true,
					message: "Assets deleted successfully",
				};
			}),
		),
	);
