import type { ActivityRunId, AssetId } from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	applyMetadataSuggestion,
	type GenerateAssetMetadataPayload,
	type MetadataSuggestion,
} from "@orcai/schema";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { boundRepository, settleStage } from "./activity";
import { queueMetadataGeneration } from "./asset-metadata";
import { queueIndexing } from "./asset-pipeline";
import {
	currentIndexing,
	currentMetadata,
	currentProcessing,
	type IndexingAttempt,
	type ProcessingAttempt,
} from "./attempt";
import { serveIndexedAttempt, withLinkPoints } from "./link-points";

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
const queueAfterProcessing = (attempt: {
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

/**
 * Completes the attempt and queues indexing in every repository the asset is
 * linked to, in one transaction: a retry after a crash finds the attempt
 * still active and gets here again. An attach reads the asset's status with a
 * share lock, so a link it adds meanwhile is queued either here or by the
 * attach. A replaced attempt completes nothing and queues nothing; whether it
 * completed.
 */
export const completeProcessing = (attempt: ProcessingAttempt) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { asset } = dbSchema;

		return yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					const completed = yield* db
						.update(asset)
						.set({
							processingStatus: "completed",
							processingFailure: null,
						})
						.where(currentProcessing(attempt))
						.returning({
							id: asset.id,
						});
					if (completed.length === 0) return false;
					yield* queueAfterProcessing(attempt);
					return true;
				}),
			),
		);
	});

/**
 * Completes the indexing attempt and serves its points in one step, under
 * the link's points lock; served before the commit, so a link never reads
 * indexed without its points. Whether it completed.
 */
export const completeIndexing = (attempt: IndexingAttempt) =>
	withLinkPoints(
		attempt,
		Effect.gen(function* () {
			const db = yield* DB;
			const { blockAsset } = dbSchema;
			const written = yield* db
				.update(blockAsset)
				.set({
					indexStatus: "completed",
					indexFailure: null,
					indexedAttempt: attempt.attempt,
				})
				.where(currentIndexing(attempt))
				.returning({
					assetId: blockAsset.assetId,
				});
			if (written.length === 0) return false;
			yield* settleStage(
				attempt.runId,
				{
					stage: "indexing",
					assetId: attempt.assetId,
					blockId: attempt.blockId,
				},
				{
					state: "completed",
				},
			);
			yield* serveIndexedAttempt(attempt, attempt.attempt);
			return true;
		}),
	);

/**
 * In `review` mode the suggestion is kept whole. In `apply` mode it fills
 * empty fields on the row as it is now, so an edit saved meanwhile wins, and
 * keeps only what it could not apply; the run's member records the fields it
 * filled. Either way only while the job's generation is the asset's and
 * unfinished, so a duplicate delivery stores nothing, and a deadlocked store
 * runs again without asking the model again.
 */
export const completeMetadata = (
	data: GenerateAssetMetadataPayload,
	suggestion: MetadataSuggestion,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { activityMember, asset } = dbSchema;
		const current = currentMetadata(data);
		const target = {
			stage: "metadata",
			assetId: data.assetId,
		} as const;

		yield* retryDeadlocks(
			db.transaction(() =>
				Effect.gen(function* () {
					if (data.mode === "review") {
						const stored = yield* db
							.update(asset)
							.set({
								metadataSuggestion: suggestion,
								metadataStatus: "completed",
								metadataFailure: null,
							})
							.where(current)
							.returning({
								id: asset.id,
							});
						if (stored.length > 0) {
							yield* settleStage(data.runId, target, {
								state: "completed",
							});
						}
						return;
					}

					const [row] = yield* db
						.select({
							title: asset.title,
							fileName: asset.fileName,
							metadata: asset.metadata,
						})
						.from(asset)
						.where(current)
						.for("update");
					if (!row) {
						return;
					}
					const applied = applyMetadataSuggestion(row, suggestion);
					yield* db
						.update(asset)
						.set({
							title: applied.title,
							metadata: applied.metadata,
							metadataSuggestion: applied.review,
							metadataStatus: "completed",
							metadataFailure: null,
							updatedAt: new Date(),
						})
						.where(current);
					yield* settleStage(data.runId, target, {
						state: "completed",
					});
					if (data.runId) {
						yield* db
							.update(activityMember)
							.set({
								appliedFields: applied.filled,
							})
							.where(
								and(
									eq(activityMember.runId, data.runId),
									eq(activityMember.assetId, data.assetId),
								),
							);
					}
				}),
			),
		);
	});
