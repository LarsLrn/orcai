import { eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import {
	getJobsByResourceEffect,
	sendJobBatchEffect,
} from "@/lib/pg-boss/helpers";
import type { Job } from "@/lib/pg-boss/schema/job";
import {
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@/lib/pg-boss/schema/job-queues";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import { deletePointsByIdentifier } from "@/qdrant/mutations";

const getLatestJobForAsset = (
	jobs: Job[],
	assetId: string,
	key: "assetId" | "processAssetId",
) => {
	const matching = jobs.filter((job) => {
		if (job.name === PROCESS_ASSET_JOB_NAME) {
			return key === "processAssetId" && job.data.assetRef.id === assetId;
		}

		return key === "assetId" && job.data.assetId === assetId;
	});

	return matching.sort(
		(a, b) => b.createdOn.getTime() - a.createdOn.getTime(),
	)[0];
};

export const getAttachmentIndexingStatus = (params: {
	processJobs: Job[];
	vectorizeJobs: Job[];
	assetId: string;
}) => {
	const processJob = getLatestJobForAsset(
		params.processJobs,
		params.assetId,
		"processAssetId",
	);
	const vectorizeJob = getLatestJobForAsset(
		params.vectorizeJobs,
		params.assetId,
		"assetId",
	);

	/* Since vectorization depends on processing, we consider the attachment to be in the state of the latest job that has not completed yet. */
	if (processJob.state !== "completed") {
		return processJob.state;
	}

	return vectorizeJob.state;
};

export const loadDatabaseBlockAttachments = (params: { blockId: string }) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const assetRows = yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.blockAsset)
			.innerJoin(
				dbSchema.asset,
				eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
			)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));

		const [processJobs, vectorizeJobs] = yield* Effect.all(
			[
				getJobsByResourceEffect({
					jobQueue: PROCESS_ASSET_JOB_NAME,
					resourceId: params.blockId,
				}),
				getJobsByResourceEffect({
					jobQueue: VECTORIZE_ASSET_JOB_NAME,
					resourceId: params.blockId,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		return assetRows.map((asset) => ({
			asset,
			indexingStatus: getAttachmentIndexingStatus({
				processJobs,
				vectorizeJobs,
				assetId: asset.id,
			}),
		}));
	});

export const syncDatabaseBlockAssets = (params: {
	blockId: string;
	assetIds: string[];
	previousAssetIds?: string[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const previousAssetIds = yield* Effect.orElse(
			Effect.fromNullable(params.previousAssetIds),
			() =>
				db
					.select({
						assetId: dbSchema.blockAsset.assetId,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.blockId, params.blockId))
					.pipe(Effect.map((assets) => assets.map((a) => a.assetId))),
		);

		yield* db
			.delete(dbSchema.blockAsset)
			.where(eq(dbSchema.blockAsset.blockId, params.blockId));

		if (params.assetIds.length > 0) {
			yield* db.insert(dbSchema.blockAsset).values(
				params.assetIds.map((assetId) => ({
					blockId: params.blockId,
					assetId,
				})),
			);
		}

		const { removedIds, addedIds } = calculateRelationDelta(
			previousAssetIds,
			params.assetIds,
		);

		if (removedIds.length > 0 || addedIds.length > 0) {
			yield* authz.applyRelationshipMutations({
				mutations: [
					...removedIds.map((assetId) => ({
						resourceType: "asset" as const,
						resourceId: assetId,
						relation: "block" as const,
						subjectType: "block" as const,
						subjectId: params.blockId,
						operation: "delete" as const,
					})),
					...addedIds.map((assetId) => ({
						resourceType: "asset" as const,
						resourceId: assetId,
						relation: "block" as const,
						subjectType: "block" as const,
						subjectId: params.blockId,
						operation: "touch" as const,
					})),
				],
			});
		}

		if (removedIds.length > 0) {
			yield* Effect.forEach(
				removedIds,
				(assetId) =>
					deletePointsByIdentifier({
						blockId: params.blockId,
						assetId,
					}),
				{
					concurrency: "unbounded",
					discard: true,
				},
			);
		}

		if (addedIds.length > 0) {
			const assets = yield* db
				.select({
					id: dbSchema.asset.id,
					bucket: dbSchema.asset.bucket,
					type: dbSchema.asset.fileType,
					prefix: dbSchema.asset.prefix,
					metadata: dbSchema.asset.metadata,
				})
				.from(dbSchema.asset)
				.where(inArray(dbSchema.asset.id, addedIds));

			yield* sendJobBatchEffect({
				jobName: PROCESS_ASSET_JOB_NAME,
				jobs: assets.map((asset) => ({
					data: {
						assetRef: {
							bucket: asset.bucket,
							prefix: asset.prefix,
							id: asset.id,
							type: getFileTypeFromMime(asset.type),
						},
						blockId: params.blockId,
						mergePages: asset.metadata.mergePages ?? false,
					},
				})),
				resourceOptions: {
					resourceId: params.blockId,
					resourceType: "block",
				},
			});
		}

		return {
			assetIds: params.assetIds,
			addedIds,
			removedIds,
		};
	});
