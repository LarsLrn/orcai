import { buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { deletePointsByIdentifier } from "@orcai/qdrant";
import { UPLOAD_ROUTES } from "@orcai/s3";
import {
	deletePrefixRecursively,
	sendDeleteObjectCommand,
} from "@orcai/s3/server";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import { and, count, desc, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { createAssetsFromUploads } from "@/lib/assets/intake";
import { reprocessAsset } from "@/lib/assets/processing";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import {
	getEntityCapabilities,
	getManyEntityCapabilities,
} from "@/lib/authz/entity-capabilities";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "@/lib/utils/literal-search";

const listAssets = authed.asset.list.effect(function* ({ input, context }) {
	const db = yield* DB;

	const allowedIds = yield* lookupEntitiesByPermission({
		userId: context.auth.user.id,
		permission: "read",
		entityType: "asset",
		zedToken: getZedToken(context, input),
	});

	const whereConditions = [
		inArray(dbSchema.asset.id, allowedIds),
	];

	if (input.filters?.ids) {
		whereConditions.push(inArray(dbSchema.asset.id, input.filters.ids));
	}

	if (input.filters?.search) {
		whereConditions.push(
			ilike(dbSchema.asset.title, literalSearch(input.filters.search)),
		);
	}

	if (input.filters?.origin) {
		whereConditions.push(eq(dbSchema.asset.origin, input.filters.origin));
	}

	if (input.filters?.repositoryId) {
		whereConditions.push(
			inArray(
				dbSchema.asset.id,
				db
					.select({
						assetId: dbSchema.blockAsset.assetId,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.blockId, input.filters.repositoryId)),
			),
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
		Effect.flatMap(([data, [countResult]]) =>
			Effect.gen(function* () {
				const capabilities = yield* getManyEntityCapabilities({
					entityType: "asset",
					entityIds: data.map((asset) => asset.id),
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				});

				return {
					data: data.map((asset) => ({
						...asset,
						capabilities:
							capabilities.get(asset.id) ?? emptyCapabilities("asset"),
					})),
					rowCount: countResult.count,
				};
			}),
		),
	);
});

const findAsset = authed.asset.find
	.use(
		requireEntityPermission("asset", "read", {
			entityId: "id",
			zedToken: "zedToken",
		}),
	)
	.effect(function* ({ input, context }) {
		const db = yield* DB;

		const [query] = yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, input.id));

		if (!query) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ASSET_NOT_FOUND",
					message: "Asset not found",
				}),
			);
		}

		return {
			data: {
				...query,
				capabilities: yield* getEntityCapabilities({
					entityType: "asset",
					entityId: query.id,
					userId: context.auth.user.id,
					zedToken: getZedToken(context, input),
				}),
			},
		};
	});

const saveAsset = authed.asset.save
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

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
	});

const addAssetToLibrary = authed.asset.addToLibrary
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [asset] = yield* db
			.update(dbSchema.asset)
			.set({
				origin: "library",
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.asset.id, input.id))
			.returning({
				...getColumns(dbSchema.asset),
			});

		return {
			data: asset,
		};
	});

const createAssetsFromUploadsProcedure = authed.asset.createFromUploads
	.use(requireOrganizationPermission("create_asset"))
	.effect(function* ({ input, context }) {
		const route = UPLOAD_ROUTES[input.route];

		if (input.files.length > route.maxFiles) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "UPLOAD_TOO_MANY_FILES",
					params: {
						maxFiles: route.maxFiles,
					},
					message: `Too many files. Max allowed: ${route.maxFiles}.`,
				}),
			);
		}

		return {
			data: yield* createAssetsFromUploads({
				route: input.route,
				files: input.files,
				userId: context.auth.user.id,
				organizationId: context.auth.session.activeOrganizationId,
			}),
		};
	});

const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware("asset").adaptInput(
			(input): CheckManyPermissionInputFor<"asset"> => ({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
			}),
		),
	)
	.effect(function* ({ context }) {
		const db = yield* DB;

		const allowedIds = context.allowedIds ?? [];

		if (allowedIds.length === 0) {
			return {
				success: true,
				message: "No assets to delete",
			};
		}

		const assetsToDelete = yield* db
			.select()
			.from(dbSchema.asset)
			.where(inArray(dbSchema.asset.id, allowedIds));

		yield* Effect.all(
			assetsToDelete.map((asset) =>
				Effect.gen(function* () {
					yield* sendDeleteObjectCommand({
						bucket: asset.bucket,
						key: `${asset.prefix}/${asset.id}.${asset.fileType}`,
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

		yield* deleteResourcesWithAuthorization({
			resourceType: "asset",
			resourceIds: allowedIds,
		});

		return {
			success: true,
			message: "Assets deleted successfully",
		};
	});

const reprocessAssetProcedure = authed.asset.reprocess
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const [asset] = yield* db
			.select()
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, input.id));

		if (!asset) {
			return yield* new AppErrors.NotFoundError({
				reason: "ASSET_NOT_FOUND",
				message: "Asset not found",
			});
		}

		if (!(yield* reprocessAsset(asset))) {
			return yield* new AppErrors.BadRequestError({
				reason: "DOCUMENT_STILL_PREPARING",
				message: "The asset is still being processed",
			});
		}

		return {
			success: true,
			message: "Asset queued for processing",
		};
	});

export const assetRouter = {
	list: listAssets,
	save: saveAsset,
	createFromUploads: createAssetsFromUploadsProcedure,
	addToLibrary: addAssetToLibrary,
	find: findAsset,
	delete: deleteAssets,
	reprocess: reprocessAssetProcedure,
};
