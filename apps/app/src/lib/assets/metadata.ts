import type { AssetId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";

/**
 * The organisation's prepared library assets the user can edit whose metadata
 * was never generated, or failed: what a backfill generates. `ids` narrows them.
 */
export const assetsMissingMetadata = (params: {
	userId: UserId;
	organizationId: OrganizationId;
	ids?: readonly AssetId[];
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const editable = (yield* lookupEntitiesByPermission({
			userId: params.userId,
			permission: "edit",
			entityType: "asset",
			zedToken: params.zedToken,
		})).filter((id) => !params.ids || params.ids.includes(id as AssetId));
		if (editable.length === 0) {
			return [];
		}

		const db = yield* DB;
		const { asset, resourceScope } = dbSchema;
		const rows = yield* db
			.select({
				id: asset.id,
			})
			.from(asset)
			.innerJoin(
				resourceScope,
				and(
					eq(resourceScope.resourceType, "asset"),
					eq(resourceScope.resourceId, asset.id),
					eq(resourceScope.isPrimary, true),
					isNull(resourceScope.endedAt),
				),
			)
			.where(
				and(
					inArray(asset.id, editable as AssetId[]),
					eq(resourceScope.organizationId, params.organizationId),
					eq(asset.keptIn, "library"),
					eq(asset.processingStatus, "completed"),
					or(isNull(asset.metadataStatus), eq(asset.metadataStatus, "failed")),
				),
			);
		return rows.map((row) => row.id);
	});
