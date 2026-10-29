import type { AssetPointPayload } from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

// Qdrant rejects request bodies over 32 MiB; 64 points stay far below it.
const UPSERT_BATCH_SIZE = 64;

/** Upserts in batches; a failure is reported once every batch has settled, so nothing lands after it. */
export const upsertPointsToQdrant = ({ points }: { points: Point[] }) =>
	Effect.gen(function* () {
		const { client, collections, bm25Config } = yield* QdrantService;

		const settled = yield* Effect.forEach(
			Arr.chunksOf(points, UPSERT_BATCH_SIZE),
			(batch) =>
				Effect.tryPromise({
					try: async () =>
						client.upsert(collections.asset.name, {
							points: batch.map((point) => ({
								id: point.id,
								vector: {
									dense: point.vector,
									bm25: {
										text: point.payload.lexical_text ?? point.payload.text,
										model: "qdrant/bm25",
										options: bm25Config,
									},
								},
								payload: point.payload,
							})),
						}),
					catch: (cause) =>
						new QdrantError({
							operation: "upsert",
							cause,
						}),
				}).pipe(Effect.exit),
			{
				concurrency: 4,
			},
		);
		const failed = settled.find(Exit.isFailure);
		if (failed) {
			return yield* failed;
		}
	});

const unsetAttempt = {
	is_empty: {
		key: "index_attempt",
	},
};

/**
 * Indexing attempts from `from` up to, not including, `to`; an open end is
 * unbounded. Points without an attempt count as attempt 0.
 */
export type AttemptRange = {
	readonly from?: number;
	readonly to?: number;
};

const isEmpty = ({ from = 0, to }: AttemptRange) =>
	to !== undefined && to <= from;

const attemptFilter = ({ from, to }: AttemptRange) => {
	if (from === undefined && to === undefined) return [];
	const range = {
		key: "index_attempt",
		range: {
			gte: from,
			lt: to,
		},
	};
	return [
		(from ?? 0) <= 0
			? {
					should: [
						range,
						unsetAttempt,
					],
				}
			: range,
	];
};

type LinkPoints = {
	assetId: AssetPointPayload["asset_id"];
	blockId: AssetPointPayload["block_id"];
	attempts: AttemptRange;
};

const linkPointsFilter = ({ assetId, blockId, attempts }: LinkPoints) => ({
	must: [
		{
			key: "asset_id",
			match: {
				value: assetId,
			},
		},
		{
			key: "block_id",
			match: {
				value: blockId,
			},
		},
		...attemptFilter(attempts),
	],
});

/** Deletes a repository link's points of these indexing attempts. */
export const deleteAttemptPoints = (points: LinkPoints) =>
	Effect.gen(function* () {
		if (isEmpty(points.attempts)) return;
		const { client, collections } = yield* QdrantService;

		yield* Effect.tryPromise({
			try: () =>
				client.delete(collections.asset.name, {
					wait: true,
					filter: linkPointsFilter(points),
				}),
			catch: (cause) =>
				new QdrantError({
					operation: "delete",
					cause,
				}),
		});
	});

/** Serves a repository link's points of these indexing attempts, or stops serving them. */
export const publishAttemptPoints = (
	points: LinkPoints & {
		published: boolean;
	},
) =>
	Effect.gen(function* () {
		if (isEmpty(points.attempts)) return;
		const { client, collections } = yield* QdrantService;

		yield* Effect.tryPromise({
			try: () =>
				client.setPayload(collections.asset.name, {
					payload: {
						published: points.published,
					},
					filter: linkPointsFilter(points),
				}),
			catch: (cause) =>
				new QdrantError({
					operation: "publish",
					cause,
				}),
		});
	});

export const deletePointsByIdentifier = ({
	assetId,
	blockId,
}: {
	assetId: AssetPointPayload["asset_id"];
	blockId: AssetPointPayload["block_id"] | undefined;
}) =>
	Effect.gen(function* () {
		const { client, collections } = yield* QdrantService;

		const filters: Array<{
			key: string;
			match: {
				value: string | number;
			};
		}> = [];

		if (assetId !== undefined) {
			filters.push({
				key: "asset_id",
				match: {
					value: assetId,
				},
			});
		}

		if (blockId !== undefined) {
			filters.push({
				key: "block_id",
				match: {
					value: blockId,
				},
			});
		}

		return yield* Effect.tryPromise({
			try: async () =>
				client.delete(collections.asset.name, {
					wait: true,
					filter: {
						must: filters,
					},
				}),
			catch: (error) =>
				new QdrantError({
					operation: "delete",
					cause: error,
				}),
		});
	});
