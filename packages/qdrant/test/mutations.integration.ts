import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { QdrantConfigLive, QdrantConfigService } from "../src/config";
import {
	deleteAttemptPoints,
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "../src/mutations";
import { QdrantLive, QdrantService, QdrantServiceLive } from "../src/service";

const run = <A, E>(effect: Effect.Effect<A, E, QdrantService>) =>
	Effect.runPromise(effect.pipe(Effect.provide(QdrantLive)));

describe("upsertPointsToQdrant", () => {
	test("stores a document whose points exceed one request's size limit", async () => {
		const assetId = crypto.randomUUID() as AssetId;
		const stored = await run(
			Effect.gen(function* () {
				const { client, collections } = yield* QdrantService;
				// About 20 bytes per serialised float; aim past Qdrant's 32 MiB body limit.
				const pointCount = Math.ceil(
					(40 * 2 ** 20) / (collections.asset.dimensions * 20),
				);
				const points = Array.from(
					{
						length: pointCount,
					},
					(_, index) => ({
						id: crypto.randomUUID(),
						vector: Array.from(
							{
								length: collections.asset.dimensions,
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
						},
					}),
				);

				const count = yield* upsertPointsToQdrant({
					points,
				}).pipe(
					Effect.andThen(
						Effect.promise(() =>
							client.count(collections.asset.name, {
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
					Effect.ensuring(
						deletePointsByIdentifier({
							assetId,
							blockId: undefined,
						}).pipe(Effect.ignore),
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

// One-dimensional vectors make a link with enough points that deleting them takes a while.
const SmallQdrantLive = QdrantServiceLive.pipe(
	Layer.provide(
		Layer.effect(
			QdrantConfigService,
			Effect.gen(function* () {
				const { config } = yield* QdrantConfigService;
				return {
					config: {
						...config,
						embedding: {
							dimensions: 1,
						},
					},
				};
			}),
		).pipe(Layer.provide(QdrantConfigLive)),
	),
);

describe.each([
	[
		"deleteAttemptPoints",
		(assetId: AssetId, blockId: BlockId) =>
			deleteAttemptPoints({
				assetId,
				blockId,
				attempts: {
					to: 2,
				},
			}),
	],
	[
		"deletePointsByIdentifier",
		(assetId: AssetId, blockId: BlockId) =>
			deletePointsByIdentifier({
				assetId,
				blockId,
			}),
	],
] as const)("%s", (_, remove) => {
	test("returns once the points are gone", async () => {
		const assetId = crypto.randomUUID() as AssetId;
		const blockId = crypto.randomUUID() as BlockId;
		const remaining = await Effect.runPromise(
			Effect.gen(function* () {
				const { client, collections } = yield* QdrantService;
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
							client.upsert(collections.asset.name, {
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
					Effect.andThen(remove(assetId, blockId)),
					Effect.andThen(
						Effect.promise(() =>
							client.count(collections.asset.name, {
								exact: true,
								filter,
							}),
						),
					),
					Effect.ensuring(
						Effect.promise(() =>
							client.delete(collections.asset.name, {
								wait: true,
								filter,
							}),
						),
					),
				);
			}).pipe(Effect.provide(SmallQdrantLive)),
		);

		expect(remaining.count).toBe(0);
	}, 120_000);
});
