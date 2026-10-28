import { afterAll, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import type { RetrievalMode } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "../src/mutations";
import { queryAssetPoints } from "../src/queries";
import { QdrantLive, QdrantService } from "../src/service";

const run = <A, E>(effect: Effect.Effect<A, E, QdrantService>) =>
	Effect.runPromise(effect.pipe(Effect.provide(QdrantLive)));

const assetId = crypto.randomUUID() as AssetId;

/** A unit vector at cosine `similarity` to the query vector. */
const at = (similarity: number, dimensions: number) =>
	Array.from(
		{
			length: dimensions,
		},
		(_, index) =>
			index === 0
				? similarity
				: index === 1
					? Math.sqrt(1 - similarity ** 2)
					: 0,
	);

const filler = "The office keeps its records for seven years. ".repeat(12);

// "refund" is common in the collection, and the lexical points differ in length.
const points = {
	close: {
		similarity: 0.9,
		text: "Opening hours are nine to five.",
	},
	far: {
		similarity: 0.1,
		text: "Parking is free for visitors.",
	},
	shortMatch: {
		similarity: 0,
		text: "Refund policy.",
	},
	longMatch: {
		similarity: 0,
		text: `${filler}A refund is paid in time. ${filler}`,
	},
	repeatedMatch: {
		similarity: 0,
		text: "Refund rules: a refund is paid, a late refund earns interest.",
	},
};

const ids = Object.fromEntries(
	Object.keys(points).map((name) => [
		name,
		crypto.randomUUID(),
	]),
);

const stored = run(
	Effect.gen(function* () {
		const { collections } = yield* QdrantService;
		yield* upsertPointsToQdrant({
			points: Object.entries(points).map(
				([name, { similarity, text }], index) => ({
					id: ids[name],
					vector: at(similarity, collections.asset.dimensions),
					payload: {
						source: "text" as const,
						asset_id: assetId,
						block_id: crypto.randomUUID() as BlockId,
						text,
						title: "Integration",
						depth: 0,
						tokens: 8,
						chunk_index: index,
						chunkCount: Object.keys(points).length,
						createdAt: new Date().toISOString(),
					},
				}),
			),
		});
		return collections.asset.dimensions;
	}),
);

afterAll(() =>
	run(
		deletePointsByIdentifier({
			assetId,
			blockId: undefined,
		}),
	),
);

const search = async (retrievalMode: RetrievalMode) => {
	const dimensions = await stored;
	const found = await run(
		queryAssetPoints({
			embedding: at(1, dimensions),
			text: "refund",
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
			limit: 10,
			scoreThreshold: 0.5,
			retrievalMode,
		}),
	);
	return found
		.map((point) =>
			Object.keys(ids).find((name) => ids[name] === String(point.id)),
		)
		.sort();
};

describe("queryAssetPoints score threshold", () => {
	test("dense keeps the points close to the query", async () => {
		expect(await search("dense")).toEqual([
			"close",
		]);
	});

	test("hybrid applies it to the dense side and keeps every lexical match", async () => {
		expect(await search("hybrid")).toEqual([
			"close",
			"longMatch",
			"repeatedMatch",
			"shortMatch",
		]);
	});
});
