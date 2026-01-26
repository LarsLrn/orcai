import { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { assetTable } from "@/db/schema/asset";
import { blockAssetTable } from "@/db/schema/block";
import { authed } from "@/lib/orpc/implementation/authed";
import { getJobsByResource, sendJobBatch } from "@/lib/pg-boss/helpers";
import { PROCESS_ASSET_JOB_NAME } from "@/lib/pg-boss/jobs/process-asset-job";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";

export const listJobs = authed.job.list.handler(async ({ input }) => {
	// Query pg-boss directly instead of taskTable
	const jobs = await getJobsByResource({
		jobQueue: input.jobQueue,
		resourceId: input.resourceId,
	});

	return { data: jobs, rowCount: jobs.length };
});

export const createJobs = authed.job.create.handler(async ({ input }) => {
	if (input.jobRunner !== PROCESS_ASSET_JOB_NAME)
		throw new ORPCError("BAD_REQUEST", {
			message: `Only ${PROCESS_ASSET_JOB_NAME} jobRunner is currently supported`,
		});

	const docs = await db
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

	await sendJobBatch(
		PROCESS_ASSET_JOB_NAME,
		docs.map((doc) => ({
			data: {
				assetRef: {
					bucket: doc.bucket,
					prefix: doc.prefix,
					id: doc.id,
					type: getFileTypeFromMime(doc.type),
				},
				blockId: input.blockId,
				mergePages: doc.metadata.mergePages ?? true,
			},
		})),
		{
			resourceId: input.blockId,
			resourceType: "block",
		},
	);

	return {
		success: true,
		message: `Created ${docs.length} jobs to process assets for block ${input.blockId}`,
	};
});
