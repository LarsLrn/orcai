import type { OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { queueMetadataGeneration } from "@orcai/pg-boss";
import { UPLOAD_ROUTES } from "@orcai/s3";
import { fitMetadataToSourceType, metadataSchema } from "@orcai/schema";
import { checkEntityPermission } from "@orcai/spice-db";
import { and, eq, getColumns, isNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { homeOrganization, inActivityRun } from "@/lib/activity/admission";
import { listAssetTiles } from "@/lib/assets/asset-list";
import { createAssetsFromUploads } from "@/lib/assets/intake";
import { assetsMissingMetadata } from "@/lib/assets/metadata";
import { prepareAssetAgain } from "@/lib/assets/processing";
import { requireReadable } from "@/lib/authz/content-access";
import { requireEligibleOwner } from "@/lib/authz/eligible-owner";
import { getEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { writeRelationships } from "@/lib/authz/relationship-write";
import {
	deleteResourcesWithAuthorization,
	homeOrganizationId,
	resourceOrganizations,
} from "@/lib/authz/resource-lifecycle";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { libraryAccess } from "@/lib/library/library-access";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";

const listAssets = authed.asset.list.effect(function* ({ input, context }) {
	const reader = {
		userId: context.auth.user.id,
		organizationId: context.auth.session.activeOrganizationId,
		zedToken: getZedToken(context, input),
	};
	return yield* listAssetTiles({
		input,
		reader,
		access: yield* libraryAccess(reader),
	});
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
		yield* requireReadable("asset", input.id, {
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		const [query] = yield* db
			.select({
				...getColumns(dbSchema.asset),
				organizationId: dbSchema.organization.id,
				utilityModelId: dbSchema.organization.utilityModelId,
				owner: ownerColumns,
			})
			.from(dbSchema.asset)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.asset.userId))
			.leftJoin(
				dbSchema.resourceScope,
				and(
					eq(dbSchema.resourceScope.resourceType, "asset"),
					eq(dbSchema.resourceScope.resourceId, dbSchema.asset.id),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
				),
			)
			.leftJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, dbSchema.resourceScope.organizationId),
			)
			.where(eq(dbSchema.asset.id, input.id));

		if (!query) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ASSET_NOT_FOUND",
					message: "Asset not found",
				}),
			);
		}

		const { utilityModelId, organizationId, ...asset } = query;
		const zedToken = getZedToken(context, input);
		// Readers from outside the organisation learn nothing about it.
		const readsOrganization =
			organizationId !== null &&
			(yield* checkEntityPermission({
				entityType: "organization",
				entityId: organizationId as OrganizationId,
				permission: "read",
				userId: context.auth.user.id,
				zedToken,
			}));
		return {
			data: {
				...asset,
				organizationId: readsOrganization ? organizationId : null,
				utilityModel: readsOrganization ? utilityModelId !== null : null,
				capabilities: yield* getEntityCapabilities({
					entityType: "asset",
					entityId: query.id,
					userId: context.auth.user.id,
					organizationId: context.auth.session.activeOrganizationId,
					zedToken,
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

		// Under the row lock a generation applying meanwhile waits, and its
		// fields survive unless named here; the result fits its source type.
		const asset = yield* db.transaction(() =>
			Effect.gen(function* () {
				const [stored] = yield* db
					.select({
						metadata: dbSchema.asset.metadata,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.id))
					.for("update");
				const [saved] = yield* db
					.update(dbSchema.asset)
					.set({
						...(input.title !== undefined && {
							title: input.title,
						}),
						...(stored &&
							input.metadata !== undefined && {
								metadata: metadataSchema.parse(
									fitMetadataToSourceType({
										...stored.metadata,
										...input.metadata,
									}),
								),
							}),
						updatedAt: new Date(),
						...(input.metadataGeneration !== undefined && {
							metadataSuggestion: sql`case when ${dbSchema.asset.metadataGeneration} = ${input.metadataGeneration} then null else ${dbSchema.asset.metadataSuggestion} end`,
						}),
					})
					.where(eq(dbSchema.asset.id, input.id))
					.returning({
						...getColumns(dbSchema.asset),
					});
				return saved;
			}),
		);

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
		const resource = {
			resourceType: "asset" as const,
			resourceId: input.id,
		};

		// A Library asset is new content, so its owner must still be able to own it.
		const { result: asset } = yield* writeRelationships(
			{
				organizationIds: resourceOrganizations([
					resource,
				]),
			},
			Effect.gen(function* () {
				const [owner] = yield* db
					.select({
						userId: dbSchema.asset.userId,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.id))
					.for("update");
				const organizationId = yield* homeOrganizationId(resource);
				if (!owner || !organizationId)
					return yield* new AppErrors.NotFoundError({
						reason: "ASSET_NOT_FOUND",
						message: "Asset not found",
					});
				yield* requireEligibleOwner({
					organizationId,
					userId: owner.userId,
				});
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
				return asset;
			}),
		);

		const admitted = yield* queueMetadataGeneration({
			assetIds: [
				input.id,
			],
			mode: "apply",
			onlyMissing: true,
		});

		return {
			data:
				admitted.length > 0
					? {
							...asset,
							metadataStatus: "pending" as const,
						}
					: asset,
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

		const { results, runId } = yield* createAssetsFromUploads({
			route: input.route,
			files: input.files,
			uploadKey: input.uploadKey,
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
		});
		return {
			data: results,
			runId,
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
		const allowedIds = context.allowedIds ?? [];

		if (allowedIds.length === 0) {
			return {
				success: true,
				message: "No assets to delete",
			};
		}

		yield* deleteResourcesWithAuthorization({
			resourceType: "asset",
			resourceIds: allowedIds,
		});

		return {
			success: true,
			message: "Assets deleted successfully",
		};
	});

const prepareAssetAgainProcedure = authed.asset.prepareAgain
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
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

		const admitted = yield* inActivityRun(
			{
				userId: context.auth.user.id,
				kind: "retry",
				organizationId: homeOrganization("asset", asset.id),
			},
			(runId) =>
				prepareAssetAgain(asset, {
					id: runId,
				}),
		);
		if (!admitted) {
			return yield* new AppErrors.BadRequestError({
				reason: "ASSET_STILL_PREPARING",
				message: "The asset is still being processed",
			});
		}

		return {
			success: true,
			message: "Asset queued for processing",
		};
	});

const generateAssetMetadata = authed.asset.generateMetadata
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const admitted = yield* inActivityRun(
			{
				userId: context.auth.user.id,
				kind: "suggest_metadata",
				organizationId: homeOrganization("asset", input.id),
			},
			(runId) =>
				queueMetadataGeneration({
					assetIds: [
						input.id,
					],
					mode: "review",
					userId: context.auth.user.id,
					runId,
				}),
		);
		if (admitted.length === 0) {
			return yield* new AppErrors.BadRequestError({
				reason: "METADATA_GENERATION_UNAVAILABLE",
				message:
					"The asset is not a prepared library asset of an organisation with a utility model",
			});
		}

		return {
			success: true,
			message: "Metadata generation queued",
		};
	});

const dismissMetadataSuggestion = authed.asset.dismissMetadataSuggestion
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;
		yield* db
			.update(dbSchema.asset)
			.set({
				metadataSuggestion: null,
			})
			.where(
				and(
					eq(dbSchema.asset.id, input.id),
					eq(dbSchema.asset.metadataGeneration, input.generation),
				),
			);

		return {
			success: true,
		};
	});

const missingMetadata = authed.asset.missingMetadata
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ context }) {
		const assetIds = yield* assetsMissingMetadata({
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: getZedToken(context),
		});
		return {
			count: assetIds.length,
		};
	});

const generateMissingMetadata = authed.asset.generateMissingMetadata
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const assetIds = yield* assetsMissingMetadata({
			userId: context.auth.user.id,
			organizationId: context.auth.session.activeOrganizationId,
			ids: input.ids,
			zedToken: getZedToken(context),
		});
		const admitted = yield* inActivityRun(
			{
				userId: context.auth.user.id,
				kind: "fill_metadata",
				organizationId: context.auth.session.activeOrganizationId,
			},
			(runId) =>
				queueMetadataGeneration({
					assetIds,
					mode: "apply",
					onlyMissing: true,
					userId: context.auth.user.id,
					runId,
				}),
		);
		return {
			count: admitted.length,
		};
	});

export const assetRouter = {
	list: listAssets,
	save: saveAsset,
	createFromUploads: createAssetsFromUploadsProcedure,
	addToLibrary: addAssetToLibrary,
	find: findAsset,
	delete: deleteAssets,
	prepareAgain: prepareAssetAgainProcedure,
	generateMetadata: generateAssetMetadata,
	dismissMetadataSuggestion,
	missingMetadata,
	generateMissingMetadata,
};
