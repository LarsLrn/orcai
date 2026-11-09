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

// Only "meaning" is close to the query, only "keyword" says "refund", and the rest are nearer in meaning than "keyword".
const points = {
	meaning: {
		similarity: 0.9,
		text: "Opening hours are nine to five.",
	},
	near: {
		similarity: 0.5,
		text: "Parking is free for visitors.",
	},
	nearer: {
		similarity: 0.6,
		text: "The office keeps its records for seven years.",
	},
	nearest: {
		similarity: 0.7,
		text: "Visitors park in the north lot.",
	},
	keyword: {
		similarity: 0,
		text: "Refund policy.",
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

const search = async (retrievalMode: RetrievalMode, limit: number) => {
	const found = await run(
		queryAssetPoints({
			queries: [
				{
					text: "refund",
					vector: at(1, dimensions),
				},
			],
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
			limit,
			retrievalMode,
		}),
	);
	return found.map((point) =>
		Object.keys(ids).find((name) => ids[name] === String(point.id)),
	);
};

describe("queryAssetPoints", () => {
	test("dense ranks by meaning alone", async () => {
		expect(await search("dense", 2)).toEqual([
			"meaning",
			"nearest",
		]);
	});

	test("sparse finds the keyword alone", async () => {
		expect(await search("sparse", 5)).toEqual([
			"keyword",
		]);
	});

	test("hybrid surfaces both the keyword match and the meaning match", async () => {
		expect((await search("hybrid", 2)).sort()).toEqual([
			"keyword",
			"meaning",
		]);
	});
});
