import type { AssetId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { UploadedAsset } from "@orcai/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { readableIds } from "@/lib/authz/content-access";

/**
 * The assets of `ids` that the reader uploaded in the organisation and can
 * still read, with their current titles, in the order given.
 */
export const ownUploads = (
	ids: readonly AssetId[],
	reader: {
		userId: UserId;
		organizationId: OrganizationId;
		zedToken: string | undefined;
	},
) =>
	Effect.gen(function* () {
		const readable = yield* readableIds("asset", ids, reader);
		if (readable.size === 0) return [];
		const rows = yield* (yield* DB)
			.select({
				id: dbSchema.asset.id,
				title: dbSchema.asset.title,
			})
			.from(dbSchema.asset)
			.innerJoin(
				dbSchema.resourceScope,
				and(
					eq(dbSchema.resourceScope.resourceType, "asset"),
					eq(dbSchema.resourceScope.resourceId, dbSchema.asset.id),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
					eq(dbSchema.resourceScope.organizationId, reader.organizationId),
				),
			)
			.where(
				and(
					inArray(dbSchema.asset.id, [
						...readable,
					]),
					eq(dbSchema.asset.userId, reader.userId),
				),
			);
		return [
			...new Set(ids),
		].flatMap((id): UploadedAsset[] => rows.filter((row) => row.id === id));
	});
