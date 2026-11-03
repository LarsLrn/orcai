import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { GenerationWrite } from "../src/generation";
import { deleteAttemptPoints, upsertPointsToQdrant } from "../src/mutations";
import { QdrantService } from "../src/service";
import { testCollectionRuntime } from "./test-collection";

const DIMENSIONS = 1024;

describe("upsertPointsToQdrant", () => {
	const wide = testCollectionRuntime(DIMENSIONS);

	test("stores a document whose points exceed one request's size limit", async () => {
		const assetId = crypto.randomUUID() as AssetId;
		const stored = await wide.runPromise(
			Effect.gen(function* () {
				const { client } = yield* QdrantService;
				const { collection } = yield* GenerationWrite;
				// About 20 bytes per serialised float; aim past Qdrant's 32 MiB body limit.
				const pointCount = Math.ceil((40 * 2 ** 20) / (DIMENSIONS * 20));
				const points = Array.from(
					{
						length: pointCount,
					},
					(_, index) => ({
						id: crypto.randomUUID(),
						vector: Array.from(
							{
								length: DIMENSIONS,
							},
							() => Math.random() - 0.5,
						),
						payload: {
							source: "text" as const,
							asset_id: assetId,
							block_id: crypto.randomUUID() as BlockId,
							text: `Chunk ${index}`,
							depth: 0,
							tokens: 2,
							chunk_index: index,
							chunkCount: pointCount,
							createdAt: new Date().toISOString(),
							index_attempt: 1,
							published: true,
						},
					}),
				);

				const count = yield* upsertPointsToQdrant({
					points,
				}).pipe(
					Effect.andThen(
						Effect.promise(() =>
							client.count(collection, {
								exact: true,
								filter: {
									must: [
										{
											key: "asset_id",
											match: {
												value: assetId,
											},
										},
									],
								},
							}),
						),
					),
				);
				return {
					count: count.count,
					pointCount,
				};
			}),
		);

		expect(stored.count).toBe(stored.pointCount);
	}, 120_000);
});

describe("deleteAttemptPoints", () => {
	// One-dimensional vectors make a link with enough points that deleting them takes a while.
	const narrow = testCollectionRuntime(1);

	test("returns once the points are gone", async () => {
		const assetId = crypto.randomUUID() as AssetId;
		const blockId = crypto.randomUUID() as BlockId;
		const remaining = await narrow.runPromise(
			Effect.gen(function* () {
				const { client } = yield* QdrantService;
				const { collection } = yield* GenerationWrite;
				const filter = {
					must: [
						{
							key: "asset_id",
							match: {
								value: assetId,
							},
						},
					],
				};
				return yield* Effect.forEach(
					Arr.chunksOf(
						Arr.makeBy(20_000, () => crypto.randomUUID()),
						5_000,
					),
					(ids) =>
						Effect.promise(() =>
							client.upsert(collection, {
								points: ids.map((id) => ({
									id,
									vector: {
										dense: [
											1,
										],
									},
									payload: {
										asset_id: assetId,
										block_id: blockId,
										index_attempt: 1,
									},
								})),
							}),
						),
				).pipe(
					Effect.andThen(
						deleteAttemptPoints({
							assetId,
							blockId,
							attempts: {
								to: 2,
							},
						}),
					),
					Effect.andThen(
						Effect.promise(() =>
							client.count(collection, {
								exact: true,
								filter,
							}),
						),
					),
				);
			}),
		);

		expect(remaining.count).toBe(0);
	}, 120_000);
});
