import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import {
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "../src/mutations";
import { QdrantLive, QdrantService } from "../src/service";

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
