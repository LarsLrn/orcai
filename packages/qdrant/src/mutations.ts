import type { AssetPointPayload } from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { qdrantCall } from "./client";
import { inRange, matchValue, payloadKey } from "./filter";
import { GenerationWrite } from "./generation";
import { QdrantService } from "./service";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

// Qdrant rejects request bodies over 32 MiB; 64 points stay far below it.
const UPSERT_BATCH_SIZE = 64;

/** Upserts into the generation being written, in batches; a failure is reported once every batch has settled, so nothing lands after it. */
export const upsertPointsToQdrant = ({ points }: { points: Point[] }) =>
	Effect.gen(function* () {
		const { client, bm25Config } = yield* QdrantService;
		const { collection } = yield* GenerationWrite;

		const settled = yield* Effect.forEach(
			Arr.chunksOf(points, UPSERT_BATCH_SIZE),
			(batch) =>
				qdrantCall("upsert", () =>
					client.upsert(collection, {
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
				).pipe(Effect.exit),
			{
				concurrency: 4,
			},
		);
		const failed = settled.find(Exit.isFailure);
		if (failed) {
			return yield* failed;
		}
	});

/**
 * Indexing attempts from `from` up to, not including, `to`; an open end is
 * unbounded.
 */
export type AttemptRange = {
	readonly from?: number;
	readonly to?: number;
};

const isEmpty = ({ from = 0, to }: AttemptRange) =>
	to !== undefined && to <= from;

const attemptFilter = ({ from, to }: AttemptRange) =>
	from === undefined && to === undefined
		? []
		: [
				inRange(payloadKey.indexAttempt, {
					gte: from,
					lt: to,
				}),
			];

type LinkPoints = {
	assetId: AssetPointPayload["asset_id"];
	blockId: AssetPointPayload["block_id"];
	attempts: AttemptRange;
};

const linkPointsFilter = ({ assetId, blockId, attempts }: LinkPoints) => ({
	must: [
		matchValue(payloadKey.assetId, assetId),
		matchValue(payloadKey.blockId, blockId),
		...attemptFilter(attempts),
	],
});

/** Deletes a repository link's points of these indexing attempts. */
export const deleteAttemptPoints = (points: LinkPoints) =>
	Effect.gen(function* () {
		if (isEmpty(points.attempts)) return;
		const { client } = yield* QdrantService;
		const { collection } = yield* GenerationWrite;

		yield* qdrantCall("delete", () =>
			client.delete(collection, {
				wait: true,
				filter: linkPointsFilter(points),
			}),
		);
	});

/** Serves a repository link's points of these indexing attempts, or stops serving them. */
export const publishAttemptPoints = (
	points: LinkPoints & {
		published: boolean;
	},
) =>
	Effect.gen(function* () {
		if (isEmpty(points.attempts)) return;
		const { client } = yield* QdrantService;
		const { collection } = yield* GenerationWrite;

		yield* qdrantCall("publish", () =>
			client.setPayload(collection, {
				payload: {
					published: points.published,
				},
				filter: linkPointsFilter(points),
			}),
		);
	});
