import { and, eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	getJobsByResourceEffect,
	sendJobBatchEffect,
} from "@/lib/pg-boss/helpers";
import {
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@/lib/pg-boss/schema/job-queues";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";

export const listJobs = authed.job.list
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.resourceId,
				permission: "read",
				entityType: input.resourceType,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			getJobsByResourceEffect({
				jobQueue: input.jobQueue,
				resourceId: input.resourceId,
			}).pipe(
				Effect.map((jobs) => ({
					data: jobs,
					rowCount: jobs.length,
				})),
			),
		),
	);

export const createJobs = authed.job.create
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.blockId,
				permission: "edit",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				if (input.jobRunner !== VECTORIZE_ASSET_JOB_NAME)
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: `Only ${VECTORIZE_ASSET_JOB_NAME} jobRunner is currently supported`,
						}),
					);

				const db = yield* DB;

				const assets = yield* db
					.select({
						id: dbSchema.asset.id,
						processingStatus: dbSchema.asset.processingStatus,
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.blockId, input.blockId))
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.blockAsset.assetId, dbSchema.asset.id),
					);

				const eligibleAssets = assets.filter(
					(asset) => asset.processingStatus === "completed",
				);

				if (eligibleAssets.length > 0) {
					yield* sendJobBatchEffect({
						jobName: VECTORIZE_ASSET_JOB_NAME,
						jobs: eligibleAssets.map((asset) => ({
							data: {
								prefix: asset.id,
								assetId: asset.id,
								blockId: input.blockId,
							},
						})),
						resourceOptions: {
							resourceId: input.blockId,
							resourceType: "block",
						},
					});
				}

				const skippedAssets = assets.length - eligibleAssets.length;

				return {
					success: true,
					message: `Created ${eligibleAssets.length} jobs to vectorize assets for block ${input.blockId}${
						skippedAssets > 0
							? `. Skipped ${skippedAssets} asset(s) that are not processed yet`
							: ""
					}`,
				};
			}),
		),
	);

export const retryProcessing = authed.job.retryProcessing
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.assetId,
				permission: "edit",
				entityType: "asset",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [asset] = yield* db
					.select({
						...getColumns(dbSchema.asset),
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, input.assetId));

				if (!asset) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Asset not found",
						}),
					);
				}

				yield* db
					.update(dbSchema.asset)
					.set({
						processingStatus: "pending",
					})
					.where(eq(dbSchema.asset.id, input.assetId));

				yield* sendJobBatchEffect({
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

				return {
					success: true,
					message: "Processing job re-dispatched",
				};
			}),
		),
	);

export const retryVectorization = authed.job.retryVectorization
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.blockId,
				permission: "edit",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [blockAsset] = yield* db
					.select({
						assetId: dbSchema.blockAsset.assetId,
						processingStatus: dbSchema.asset.processingStatus,
					})
					.from(dbSchema.blockAsset)
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.asset.id, dbSchema.blockAsset.assetId),
					)
					.where(
						and(
							eq(dbSchema.blockAsset.blockId, input.blockId),
							eq(dbSchema.blockAsset.assetId, input.assetId),
						),
					);

				if (!blockAsset) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Asset not attached to this block",
						}),
					);
				}

				if (blockAsset.processingStatus !== "completed") {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								"Vectorization can only be retried after asset processing has completed successfully",
						}),
					);
				}

				yield* sendJobBatchEffect({
					jobName: VECTORIZE_ASSET_JOB_NAME,
					jobs: [
						{
							data: {
								prefix: input.assetId,
								assetId: input.assetId,
								blockId: input.blockId,
							},
						},
					],
					resourceOptions: {
						resourceId: input.blockId,
						resourceType: "block",
					},
				});

				return {
					success: true,
					message: "Vectorization job re-dispatched",
				};
			}),
		),
	);
