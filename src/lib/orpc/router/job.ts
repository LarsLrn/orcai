import { eq } from "drizzle-orm";
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
import { VECTORIZE_ASSET_JOB_NAME } from "@/lib/pg-boss/schema/job-queues";

export const listJobs = authed.job.list
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.resourceId,
				permission: "read",
				entityType: "block",
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
					})
					.from(dbSchema.blockAsset)
					.where(eq(dbSchema.blockAsset.blockId, input.blockId))
					.innerJoin(
						dbSchema.asset,
						eq(dbSchema.blockAsset.assetId, dbSchema.asset.id),
					);

				yield* sendJobBatchEffect({
					jobName: VECTORIZE_ASSET_JOB_NAME,
					jobs: assets.map((asset) => ({
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

				return {
					success: true,
					message: `Created ${assets.length} jobs to vectorize assets for block ${input.blockId}`,
				};
			}),
		),
	);
