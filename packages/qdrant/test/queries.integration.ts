import { beforeAll, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import type { RetrievalMode } from "@orcai/schema";
import { upsertPointsToQdrant } from "../src/mutations";
import { queryAssetPoints } from "../src/queries";
import { SETUP_TIMEOUT, testCollectionRuntime } from "./test-collection";

const dimensions = 8;
const run = testCollectionRuntime(dimensions).runPromise;

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

beforeAll(
	() =>
		run(
			upsertPointsToQdrant({
				points: Object.entries(points).map(
					([name, { similarity, text }], index) => ({
						id: ids[name],
						vector: at(similarity, dimensions),
						payload: {
							source: "text" as const,
							asset_id: assetId,
							block_id: crypto.randomUUID() as BlockId,
							text,
							depth: 0,
							tokens: 8,
							chunk_index: index,
							chunkCount: Object.keys(points).length,
							createdAt: new Date().toISOString(),
							index_attempt: 1,
							published: true,
						},
					}),
				),
			}),
		),
	SETUP_TIMEOUT,
);

const search = async (retrievalMode: RetrievalMode) => {
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
