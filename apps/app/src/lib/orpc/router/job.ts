import { DB, dbSchema } from "@orcai/db";
import { getJobsByResource } from "@orcai/pg-boss";
import { VECTORIZE_ASSET_JOB_NAME } from "@orcai/schema";
import { and, eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { enqueueAssetProcessing } from "@/lib/assets/processing";
import { enqueueIndexing } from "@/lib/blocks/database-block";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireEntityPermission,
	requireResourcePermission,
} from "@/lib/orpc/middlewares/permission";

const listJobs = authed.job.list
	.use(requireResourcePermission("read"))
	.effect(function* ({ input }) {
		return yield* getJobsByResource({
			jobQueue: input.jobQueue,
			resourceId: input.resourceId,
		}).pipe(
			Effect.map((jobs) => ({
				data: jobs,
				rowCount: jobs.length,
			})),
		);
	});

const createJobs = authed.job.create
	.use(
		requireEntityPermission("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input }) {
		if (input.jobRunner !== VECTORIZE_ASSET_JOB_NAME)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "JOB_RUNNER_UNSUPPORTED",
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

		yield* enqueueIndexing({
			blockId: input.blockId,
			assetIds: eligibleAssets.map((asset) => asset.id),
		});

		const skippedAssets = assets.length - eligibleAssets.length;

		return {
			success: true,
			message: `Created ${eligibleAssets.length} jobs to vectorize assets for block ${input.blockId}${
				skippedAssets > 0
					? `. Skipped ${skippedAssets} asset(s) that are not processed yet`
					: ""
			}`,
		};
	});

const retryProcessing = authed.job.retryProcessing
	.use(
		requireEntityPermission("asset", "edit", {
			entityId: "assetId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [asset] = yield* db
			.select({
				...getColumns(dbSchema.asset),
			})
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, input.assetId));

		if (!asset) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ASSET_NOT_FOUND",
					message: "Asset not found",
				}),
			);
		}

		yield* enqueueAssetProcessing(asset);

		return {
			success: true,
			message: "Processing job re-dispatched",
		};
	});

const retryVectorization = authed.job.retryVectorization
	.use(
		requireEntityPermission("block", "edit", {
			entityId: "blockId",
		}),
	)
	.effect(function* ({ input }) {
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
				new AppErrors.NotFoundError({
					reason: "ASSET_NOT_ATTACHED",
					message: "Asset not attached to this block",
				}),
			);
		}

		if (blockAsset.processingStatus !== "completed") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "VECTORIZE_RETRY_NOT_READY",
					message:
						"Vectorization can only be retried after asset processing has completed successfully",
				}),
			);
		}

		yield* enqueueIndexing({
			blockId: input.blockId,
			assetIds: [
				input.assetId,
			],
		});

		return {
			success: true,
			message: "Vectorization job re-dispatched",
		};
	});

export const jobRouter = {
	list: listJobs,
	create: createJobs,
	retryProcessing,
	retryVectorization,
};
