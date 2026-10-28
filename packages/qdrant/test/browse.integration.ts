import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPointBrowseCursor } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { browseAssetPoints } from "../src/browse";
import { upsertPointsToQdrant } from "../src/mutations";
import { QdrantLive, QdrantService } from "../src/service";

let calls = 0;

/** The live service, its client counting every request. */
const CountingQdrant = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const service = yield* QdrantService;
		const client = new Proxy(service.client, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver);
				return typeof value === "function"
					? (...args: unknown[]) => {
							calls++;
							return value.apply(target, args);
						}
					: value;
			},
		});
		return {
			...service,
			client,
		};
	}),
).pipe(Layer.provide(QdrantLive));

const run = <A, E>(effect: Effect.Effect<A, E, QdrantService>) =>
	Effect.runPromise(effect.pipe(Effect.provide(CountingQdrant)));

describe("browseAssetPoints in reading order", () => {
	test("pages a document of more than 1,000 passages with at most four requests a page", async () => {
		const assetId = crypto.randomUUID() as AssetId;
		const blockId = crypto.randomUUID() as BlockId;
		// Text: 60 passages on page 1, then three a page, every tenth ending on the next
		// page; 80 images on every fourth page; 70 passages without a page.
		const passages = Array.from(
			{
				length: 1_200,
			},
			(_, chunkIndex) => {
				const page =
					chunkIndex < 60
						? 1
						: chunkIndex < 1_050
							? 2 + Math.floor((chunkIndex - 60) / 3)
							: chunkIndex < 1_130
								? 1 + (chunkIndex - 1_050) * 4
								: undefined;
				return {
					chunkIndex,
					page,
					lastPage:
						page !== undefined && chunkIndex < 1_050 && chunkIndex % 10 === 9
							? page + 1
							: page,
					source: chunkIndex < 1_050 ? ("text" as const) : ("image" as const),
				};
			},
		);

		const pages = await run(
			Effect.gen(function* () {
				const { collections } = yield* QdrantService;
				const vector = Array.from(
					{
						length: collections.asset.dimensions,
					},
					(_, position) => (position === 0 ? 1 : 0),
				);
				yield* upsertPointsToQdrant({
					points: passages.map((passage) => ({
						id: crypto.randomUUID(),
						vector,
						payload: {
							source: passage.source,
							asset_id: assetId,
							block_id: blockId,
							text: `Passage ${passage.chunkIndex}`,
							chunkPageStart: passage.page,
							chunkPageEnd: passage.lastPage,
							depth: 0,
							tokens: 2,
							chunk_index: passage.chunkIndex,
							chunkCount: passages.length,
							createdAt: new Date().toISOString(),
						},
					})),
				});

				const read: {
					chunks: number[];
					calls: number;
				}[] = [];
				let cursor: AssetPointBrowseCursor | undefined;
				do {
					calls = 0;
					const page = yield* browseAssetPoints({
						filter: {
							must: [
								{
									key: "block_id",
									match: {
										value: blockId,
									},
								},
								{
									key: "asset_id",
									match: {
										any: [
											assetId,
										],
									},
								},
							],
						},
						order: "reading",
						cursor,
						limit: 50,
					});
					read.push({
						chunks: page.data.map((point) => point.payload.chunk_index),
						calls,
					});
					cursor = page.nextCursor ?? undefined;
				} while (cursor);
				return read;
			}),
		);

		const expected = [
			...passages,
		]
			.sort(
				(a, b) =>
					(a.page ?? Number.POSITIVE_INFINITY) -
						(b.page ?? Number.POSITIVE_INFINITY) || a.chunkIndex - b.chunkIndex,
			)
			.map((passage) => passage.chunkIndex);

		expect(pages.flatMap((page) => page.chunks)).toEqual(expected);
		expect(pages).toHaveLength(24);
		expect(pages.every((page) => page.chunks.length === 50)).toBe(true);
		expect(Math.max(...pages.map((page) => page.calls))).toBeLessThanOrEqual(4);
	}, 60_000);
});
