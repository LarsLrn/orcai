import type { AssetId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema, homeScopeOf, idIn } from "@orcai/db";
import { permittedEntityIds, type ReadRevision } from "@orcai/spice-db";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { permittedNow } from "@/lib/authz/content-access";

/**
 * The organisation's prepared library assets the user can edit, in SpiceDB
 * and by committed state, whose metadata was never generated, or failed: what
 * a backfill generates. `ids` narrows them.
 */
export const assetsMissingMetadata = (params: {
	userId: UserId;
	organizationId: OrganizationId;
	ids?: readonly AssetId[];
	zedToken?: ReadRevision;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset, resourceScope } = dbSchema;
		const rows = yield* db
			.select({
				id: asset.id,
			})
			.from(asset)
			.innerJoin(resourceScope, homeScopeOf("asset", asset.id))
			.where(
				and(
					params.ids ? idIn(asset.id, params.ids) : undefined,
					eq(resourceScope.organizationId, params.organizationId),
					eq(asset.keptIn, "library"),
					eq(asset.processingStatus, "completed"),
					or(isNull(asset.metadataStatus), eq(asset.metadataStatus, "failed")),
					permittedNow("asset", asset.id, params.userId, "edit"),
				),
			);
		const editable = yield* permittedEntityIds({
			entityIds: rows.map((row) => row.id),
			entityType: "asset",
			permission: "edit",
			userId: params.userId,
			zedToken: params.zedToken,
		});
		return rows.map((row) => row.id).filter((id) => editable.has(id));
	});
