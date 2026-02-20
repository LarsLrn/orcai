import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	getJobsByResourceEffect,
	sendJobBatchEffect,
} from "@/lib/pg-boss/helpers";
import { PROCESS_ASSET_JOB_NAME } from "@/lib/pg-boss/schema/job-queues";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";

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
					id: dbSchema.asset.id,
					bucket: dbSchema.asset.bucket,
					type: dbSchema.asset.fileType,
					prefix: dbSchema.asset.prefix,
					metadata: dbSchema.asset.metadata,
				})
				.from(dbSchema.blockAsset)
				.where(eq(dbSchema.blockAsset.blockId, input.blockId))
				.innerJoin(
					dbSchema.asset,
					eq(dbSchema.blockAsset.assetId, dbSchema.asset.id),
				);

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
