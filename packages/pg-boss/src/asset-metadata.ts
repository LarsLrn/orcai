import type { ActivityRunId, AssetId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	GENERATE_ASSET_METADATA_JOB_NAME,
	type GenerateAssetMetadataPayload,
	type MetadataGenerationMode,
} from "@orcai/schema";
import {
	and,
	eq,
	exists,
	inArray,
	isNotNull,
	isNull,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { admitStage, runActor } from "./activity";
import { sendJobBatchInTransaction } from "./helpers";

/**
 * Starts the next metadata generation of each library asset among `assetIds`
 * whose processing completed and whose organisation has a utility model, and
 * queues its job in the same transaction.
 * The new generation replaces any suggestion, so a job or review of an
 * earlier one changes nothing. A `review` supersedes a generation in flight;
 * an `apply` skips such an asset, and with `onlyMissing` any asset that has
 * metadata generated already. Calls are metered against `userId`, else the
 * uploader. The generations are `runId`'s work, or automatic without it.
 * Returns the assets admitted.
 */
export const queueMetadataGeneration = (params: {
	assetIds: readonly AssetId[];
	mode: MetadataGenerationMode;
	userId?: UserId;
	onlyMissing?: boolean;
	runId?: ActivityRunId;
}) =>
	Effect.gen(function* () {
		if (params.assetIds.length === 0) {
			return [];
		}
		const db = yield* DB;
		const { asset, organization, resourceScope } = dbSchema;

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const admitted = yield* db
					.update(asset)
					.set({
						metadataStatus: "pending",
						metadataFailure: null,
						metadataFailureId: null,
						metadataActorId: runActor(params.runId),
						metadataSuggestion: null,
						metadataGeneration: sql`${asset.metadataGeneration} + 1`,
					})
					.where(
						and(
							inArray(asset.id, [
								...params.assetIds,
							]),
							eq(asset.keptIn, "library"),
							eq(asset.processingStatus, "completed"),
							exists(
								db
									.select({
										id: organization.id,
									})
									.from(resourceScope)
									.innerJoin(
										organization,
										eq(organization.id, resourceScope.organizationId),
									)
									.where(
										and(
											eq(resourceScope.resourceType, "asset"),
											eq(resourceScope.resourceId, asset.id),
											eq(resourceScope.isPrimary, true),
											isNull(resourceScope.endedAt),
											isNotNull(organization.utilityModelId),
										),
									),
							),
							params.mode === "review"
								? undefined
								: or(
										isNull(asset.metadataStatus),
										params.onlyMissing
											? eq(asset.metadataStatus, "failed")
											: notInArray(asset.metadataStatus, [
													"pending",
													"active",
												]),
									),
						),
					)
					.returning({
						assetId: asset.id,
						uploaderId: asset.userId,
						generation: asset.metadataGeneration,
					});
				if (admitted.length > 0) {
					yield* admitStage(
						params.runId,
						admitted.map((row) => ({
							stage: "metadata",
							assetId: row.assetId,
						})),
					);
					yield* sendJobBatchInTransaction<GenerateAssetMetadataPayload>({
						jobName: GENERATE_ASSET_METADATA_JOB_NAME,
						jobs: admitted.map((row) => ({
							data: {
								assetId: row.assetId,
								userId: params.userId ?? row.uploaderId,
								generation: row.generation,
								mode: params.mode,
								runId: params.runId,
							},
						})),
					});
				}
				return admitted.map((row) => row.assetId);
			}),
		);
	});
