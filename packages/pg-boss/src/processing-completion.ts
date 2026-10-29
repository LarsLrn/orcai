import type { ActivityRunId, AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { boundRepository, settleStage } from "./activity";
import { queueMetadataGeneration } from "./asset-metadata";
import { queueIndexing } from "./asset-pipeline";

/**
 * After a processing attempt's fenced write completed the asset, in its
 * transaction: settles the run's processing and queues indexing in every
 * linked repository and metadata generation. The run carries on with
 * metadata and with indexing in the repository its member is bound to;
 * indexing elsewhere is automatic.
 *
 * The binding is read once the links are locked: a save that linked the
 * asset meanwhile has committed its binding with the link. Repositories are
 * locked before links and members, as repository deletion takes them; a
 * deadlock with another order is retried by the caller.
 */
export const queueAfterProcessing = (attempt: {
	readonly assetId: AssetId;
	readonly runId?: ActivityRunId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, block, blockAsset } = dbSchema;

		yield* db
			.select({
				id: block.id,
			})
			.from(block)
			.where(
				or(
					inArray(
						block.id,
						db
							.select({
								id: blockAsset.blockId,
							})
							.from(blockAsset)
							.where(eq(blockAsset.assetId, attempt.assetId)),
					),
					attempt.runId
						? inArray(
								block.id,
								db
									.select({
										id: activityMember.blockId,
									})
									.from(activityMember)
									.where(
										and(
											eq(activityMember.runId, attempt.runId),
											eq(activityMember.assetId, attempt.assetId),
										),
									),
							)
						: undefined,
				),
			)
			.orderBy(asc(block.id))
			.for("key share");
		const links = yield* db
			.select({
				assetId: blockAsset.assetId,
				blockId: blockAsset.blockId,
				attempt: blockAsset.indexAttempt,
			})
			.from(blockAsset)
			.where(eq(blockAsset.assetId, attempt.assetId))
			.orderBy(asc(blockAsset.blockId))
			.for("update");
		const bound = yield* boundRepository(attempt.runId, attempt.assetId);
		yield* settleStage(
			attempt.runId,
			{
				stage: "processing",
				assetId: attempt.assetId,
			},
			{
				state: "completed",
			},
		);

		yield* queueIndexing(
			links.filter((link) => link.blockId === bound),
			attempt.runId,
		);
		yield* queueIndexing(links.filter((link) => link.blockId !== bound));
		yield* queueMetadataGeneration({
			assetIds: [
				attempt.assetId,
			],
			mode: "apply",
			onlyMissing: true,
			runId: attempt.runId,
		});
	});
