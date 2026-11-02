import type { OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { EmbeddingIndex, maintainCollections } from "@orcai/qdrant";
import {
	isRetryableFailure,
	PIPELINE_FAILURES,
	type PipelineFailure,
} from "@orcai/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { type ObservedLink, queueIndexing } from "./asset-pipeline";

const ADMISSION_BATCH = 500;

/**
 * Failures embedding the stored extraction again can help. A missing
 * extraction needs its file prepared again, which a repository's retry does.
 */
const REEMBEDDABLE_FAILURES: readonly PipelineFailure[] =
	PIPELINE_FAILURES.filter(
		(failure) =>
			isRetryableFailure(failure) && failure !== "missing_extraction",
	);

/**
 * The links the active generation embeds: every repository link of a
 * prepared asset, within the index's repositories. Join `settings` too.
 */
const embeddable = Effect.gen(function* () {
	const { settings, blockIds } = yield* EmbeddingIndex;
	const { asset, blockAsset } = dbSchema;
	const db = yield* DB;
	return {
		links: () =>
			db
				.select({
					assetId: blockAsset.assetId,
					blockId: blockAsset.blockId,
					attempt: blockAsset.indexAttempt,
				})
				.from(blockAsset)
				.innerJoin(asset, eq(asset.id, blockAsset.assetId))
				.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`),
		where: (...conditions: ReturnType<typeof and>[]) =>
			and(
				eq(asset.processingStatus, "completed"),
				blockIds
					? inArray(blockAsset.blockId, [
							...blockIds,
						])
					: undefined,
				...conditions,
			),
		inActive: sql`${blockAsset.embeddingGeneration} is not distinct from ${settings.embeddingGeneration}`,
		settled: and(
			sql`${blockAsset.embeddingGeneration} is not distinct from ${settings.embeddingGeneration}`,
			inArray(blockAsset.indexStatus, [
				"completed",
				"failed",
			]),
		),
	};
});

/** Admits `select`'s links, a batch at a time, to embed their stored extraction again. */
const admitAll = <E, R>(
	select: () => Effect.Effect<readonly ObservedLink[], E, R>,
) =>
	Effect.gen(function* () {
		let admitted = 0;
		while (true) {
			const links = yield* select();
			if (links.length === 0) return admitted;
			const queued = yield* queueIndexing(links, undefined, {
				fromStoredExtraction: true,
			});
			admitted += queued.length;
			// Every link went to another admission meanwhile; the next run looks again.
			if (queued.length === 0) return admitted;
		}
	});

/** The active generation, and whether some link of a prepared asset has not settled in it since it started. */
const rebuildState = Effect.gen(function* () {
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const links = yield* embeddable;
	const [row] = yield* db
		.select({
			generation: settings.embeddingGeneration,
			rebuilding: sql<boolean>`${settings.embeddingRebuilding} and exists (${links
				.links()
				.where(links.where(sql`not (${links.settled})`))
				.limit(1)})`,
		})
		.from(settings);
	return {
		generation: row?.generation ?? undefined,
		rebuilding: row?.rebuilding ?? false,
	};
});

/**
 * Whether files are being re-embedded after a new generation started: some
 * link of a prepared asset has not settled in it yet. Search finds only the
 * links already embedded meanwhile.
 */
export const embeddingsRebuilding = rebuildState.pipe(
	Effect.map(({ rebuilding }) => rebuilding),
);

/**
 * Brings every repository link onto the active embedding generation. Keeps
 * Qdrant's collections on it, then admits, a batch at a time, each link of a
 * prepared asset whose indexing targets another generation or none, to embed
 * its stored extraction again. It is how waiting links, a new generation and
 * work lost to a crash get indexed; idempotent, so every run resumes where
 * the last one stopped. A rebuild ends once every link has settled. Does
 * nothing before setup. Returns the links admitted.
 */
export const reconcileEmbeddings = Effect.gen(function* () {
	yield* maintainCollections;
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const { blockAsset } = dbSchema;
	const links = yield* embeddable;

	const admitted = yield* admitAll(() =>
		links
			.links()
			.where(
				links.where(
					sql`${blockAsset.embeddingGeneration} is distinct from ${settings.embeddingGeneration}`,
				),
			)
			.limit(ADMISSION_BATCH),
	);

	const { generation, rebuilding } = yield* rebuildState;
	if (generation !== undefined && !rebuilding) {
		// A generation started since keeps its flag.
		yield* db
			.update(settings)
			.set({
				embeddingRebuilding: false,
			})
			.where(
				and(
					eq(settings.embeddingRebuilding, true),
					eq(settings.embeddingGeneration, generation),
				),
			);
	}
	return admitted;
});

/**
 * Embeds every failed link of the active generation again whose failure
 * re-embedding can help, from its stored extraction; links already embedded
 * stay. Returns the links admitted.
 */
export const retryFailedEmbeddings = Effect.gen(function* () {
	const { blockAsset } = dbSchema;
	const links = yield* embeddable;
	return yield* admitAll(() =>
		links
			.links()
			.where(
				links.where(
					links.inActive,
					eq(blockAsset.indexStatus, "failed"),
					inArray(blockAsset.indexFailure, REEMBEDDABLE_FAILURES),
				),
			)
			.limit(ADMISSION_BATCH),
	);
});

/** How far the active generation got in one organisation's repositories. */
export type OrganizationEmbeddingProgress = {
	/** Null for repositories without a home organisation. */
	readonly organizationId: OrganizationId | null;
	readonly name: string | null;
	readonly embedded: number;
	readonly waiting: number;
	readonly failed: number;
};

/**
 * Counts the active generation's links per organisation: embedded, failed,
 * and waiting for either. Failures come as counts per reason, never naming a
 * file or repository. Undefined before setup.
 */
export const embeddingProgress = Effect.gen(function* () {
	const db = yield* DB;
	const { settings } = yield* EmbeddingIndex;
	const { blockAsset, organization, resourceScope } = dbSchema;
	const links = yield* embeddable;
	const [active] = yield* db
		.select({
			generation: settings.embeddingGeneration,
		})
		.from(settings);
	if (active?.generation == null) return undefined;

	const failedInActive = and(
		links.inActive,
		eq(blockAsset.indexStatus, "failed"),
	);
	const count = (condition: ReturnType<typeof and>) =>
		sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
	const organizations = yield* db
		.select({
			organizationId: organization.id,
			name: organization.name,
			total: sql<number>`count(*)`.mapWith(Number),
			embedded: count(
				and(links.inActive, eq(blockAsset.indexStatus, "completed")),
			),
			failed: count(failedInActive),
		})
		.from(blockAsset)
		.innerJoin(dbSchema.asset, eq(dbSchema.asset.id, blockAsset.assetId))
		.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
		.leftJoin(
			resourceScope,
			and(
				eq(resourceScope.resourceType, "block"),
				eq(resourceScope.resourceId, blockAsset.blockId),
				eq(resourceScope.isPrimary, true),
				isNull(resourceScope.endedAt),
			),
		)
		.leftJoin(organization, eq(organization.id, resourceScope.organizationId))
		.where(links.where())
		.groupBy(organization.id, organization.name)
		.orderBy(organization.name);
	const failures = yield* db
		.select({
			failure: blockAsset.indexFailure,
			count: sql<number>`count(*)`.mapWith(Number),
		})
		.from(blockAsset)
		.innerJoin(dbSchema.asset, eq(dbSchema.asset.id, blockAsset.assetId))
		.innerJoin(settings, sql`${settings.embeddingGeneration} is not null`)
		.where(links.where(failedInActive))
		.groupBy(blockAsset.indexFailure)
		.orderBy(blockAsset.indexFailure);

	const failureCounts = failures.map((row) => ({
		failure: (row.failure ?? "other") as PipelineFailure,
		count: row.count,
	}));
	return {
		generation: active.generation,
		rebuilding: yield* embeddingsRebuilding,
		organizations: organizations.map(
			({ total, ...row }): OrganizationEmbeddingProgress => ({
				...row,
				organizationId: row.organizationId as OrganizationId | null,
				waiting: total - row.embedded - row.failed,
			}),
		),
		failures: failureCounts,
		retryable: failureCounts
			.filter(({ failure }) => REEMBEDDABLE_FAILURES.includes(failure))
			.reduce((sum, { count }) => sum + count, 0),
	};
});
