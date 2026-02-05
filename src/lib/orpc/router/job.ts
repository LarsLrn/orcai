import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { assetTable } from "@/db/schema/asset";
import { blockAssetTable } from "@/db/schema/block";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	getJobsByResourceEffect,
	sendJobBatchEffect,
} from "@/lib/pg-boss/helpers";
import { PROCESS_ASSET_JOB_NAME } from "@/lib/pg-boss/jobs/process-asset-job";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";

export const listJobs = authed.job.list.handler(async ({ input }) =>
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

export const createJobs = authed.job.create.handler(async ({ input, errors }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			if (input.jobRunner !== PROCESS_ASSET_JOB_NAME)
				return yield* Effect.fail(
					errors.BAD_REQUEST({
						message: `Only ${PROCESS_ASSET_JOB_NAME} jobRunner is currently supported`,
					}),
				);

			const db = yield* DB;

			const assets = yield* db
				.select({
					id: assetTable.id,
					bucket: assetTable.bucket,
					type: assetTable.fileType,
					prefix: assetTable.prefix,
					metadata: assetTable.metadata,
				})
				.from(blockAssetTable)
				.where(eq(blockAssetTable.blockId, input.blockId))
				.innerJoin(assetTable, eq(blockAssetTable.assetId, assetTable.id));

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
						blockId: input.blockId,
						mergePages: asset.metadata.mergePages ?? true,
					},
				})),
				resourceOptions: {
					resourceId: input.blockId,
					resourceType: "block",
				},
			});

			return {
				success: true,
				message: `Created ${assets.length} jobs to process assets for block ${input.blockId}`,
			};
		}),
	),
);
