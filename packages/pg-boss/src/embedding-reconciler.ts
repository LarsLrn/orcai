import { DB, dbSchema } from "@orcai/db";
import { EmbeddingIndex, maintainCollections } from "@orcai/qdrant";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { queueIndexing } from "./asset-pipeline";

const ADMISSION_BATCH = 500;

/**
 * Brings every repository link onto the active embedding generation. Keeps
 * Qdrant's collections on it, then admits, a batch at a time, each link of a
 * prepared asset whose indexing targets another generation or none, to embed
 * its stored extraction again. It is how waiting links, a first setup and
 * work lost to a crash get indexed; idempotent, so every run resumes where
 * the last one stopped. Does nothing before setup. Returns the links admitted.
 */
export const reconcileEmbeddings = Effect.gen(function* () {
	yield* maintainCollections;
	const db = yield* DB;
	const { settings, blockIds } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	let admitted = 0;

	while (true) {
		const stale = yield* db
			.select({
				assetId: blockAsset.assetId,
				blockId: blockAsset.blockId,
				attempt: blockAsset.indexAttempt,
			})
			.from(blockAsset)
			.innerJoin(asset, eq(asset.id, blockAsset.assetId))
			.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
			.where(
				and(
					eq(asset.processingStatus, "completed"),
					sql`${blockAsset.embeddingGeneration} is distinct from ${settings.embeddingGeneration}`,
					blockIds
						? inArray(blockAsset.blockId, [
								...blockIds,
							])
						: undefined,
				),
			)
			.limit(ADMISSION_BATCH);
		if (stale.length === 0) return admitted;

		const queued = yield* queueIndexing(stale, undefined, {
			fromStoredExtraction: true,
		});
		admitted += queued.length;
		// Every link went to another admission meanwhile; the next run looks again.
		if (queued.length === 0) return admitted;
	}
});
