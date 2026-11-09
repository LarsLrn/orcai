import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPointPayload } from "@orcai/schema";
import { upsertPointsToQdrant } from "../src/mutations";

/** A small corpus with fixed vectors: three assets, some passages with pages, and a vector for each query. */
export const DIM = 8;
const unit = (v: number[]) => {
	const n = Math.hypot(...v);
	return v.map((x) => x / n);
};
const e = (
	...pairs: [
		number,
		number,
	][]
) => {
	const v = Array(DIM).fill(0);
	for (const [i, x] of pairs) v[i] = x;
	return unit(v);
};

export const queryVectors: Record<string, number[]> = {
	"refund policy": e([
		0,
		1,
	]),
	"money back": e(
		[
			0,
			0.8,
		],
		[
			1,
			0.6,
		],
	),
	"opening hours": e([
		2,
		1,
	]),
	"when are you open": e(
		[
			2,
			0.7,
		],
		[
			3,
			0.7,
		],
	),
	parking: e([
		4,
		1,
	]),
	"zebra quantum": e([
		7,
		1,
	]),
	"a b": e(
		[
			0,
			0.5,
		],
		[
			2,
			0.5,
		],
		[
			4,
			0.5,
		],
	),
	"long question about the refund rules for late returns of goods": e(
		[
			0,
			0.9,
		],
		[
			5,
			0.44,
		],
	),
};

// Fixed ids: Qdrant orders equal scores by them, and the collection is the test file's own.
export const blockId = "6b0d7a8e-0000-4000-8000-000000000001" as BlockId;
export const assets = {
	a: "6b0d7a8e-0000-4000-8000-00000000000a" as AssetId,
	b: "6b0d7a8e-0000-4000-8000-00000000000b" as AssetId,
	c: "6b0d7a8e-0000-4000-8000-00000000000c" as AssetId,
};

type Seed = {
	asset: keyof typeof assets;
	text: string;
	vector: number[];
	page?: [
		number,
		number,
	];
};
const seeds: Record<string, Seed> = {
	a1: {
		asset: "a",
		text: "Our refund policy: a refund is paid within 14 days.",
		vector: e(
			[
				0,
				0.95,
			],
			[
				1,
				0.31,
			],
		),
		page: [
			1,
			1,
		],
	},
	a2: {
		asset: "a",
		text: "Refund requests need the receipt.",
		vector: e(
			[
				0,
				0.85,
			],
			[
				5,
				0.53,
			],
		),
		page: [
			1,
			2,
		],
	},
	a3: {
		asset: "a",
		text: "Money back guarantee for unopened goods.",
		vector: e(
			[
				0,
				0.6,
			],
			[
				1,
				0.8,
			],
		),
		page: [
			2,
			2,
		],
	},
	a4: {
		asset: "a",
		text: "Late returns of goods are refunded at half value under the refund rules.",
		vector: e(
			[
				0,
				0.7,
			],
			[
				5,
				0.71,
			],
		),
		page: [
			3,
			3,
		],
	},
	a5: {
		asset: "a",
		text: "The shop is open on weekdays.",
		vector: e(
			[
				2,
				0.6,
			],
			[
				3,
				0.8,
			],
		),
		page: [
			4,
			4,
		],
	},
	b1: {
		asset: "b",
		text: "Opening hours are nine to five.",
		vector: e(
			[
				2,
				0.98,
			],
			[
				6,
				0.2,
			],
		),
		page: [
			1,
			1,
		],
	},
	b2: {
		asset: "b",
		text: "We are open on Saturdays until noon, closed on Sundays.",
		vector: e(
			[
				2,
				0.5,
			],
			[
				3,
				0.86,
			],
		),
		page: [
			1,
			1,
		],
	},
	b3: {
		asset: "b",
		text: "Parking is free for visitors after opening hours.",
		vector: e(
			[
				4,
				0.9,
			],
			[
				2,
				0.44,
			],
		),
		page: [
			2,
			2,
		],
	},
	b4: {
		asset: "b",
		text: "A refund policy applies to parking tickets.",
		vector: e(
			[
				4,
				0.6,
			],
			[
				0,
				0.8,
			],
		),
		page: [
			2,
			3,
		],
	},
	b5: {
		asset: "b",
		text: "Visitors park in the north lot.",
		vector: e(
			[
				4,
				0.97,
			],
			[
				6,
				0.24,
			],
		),
		page: [
			3,
			3,
		],
	},
	c1: {
		asset: "c",
		text: "Refund refund refund: the refund desk handles every refund.",
		vector: e(
			[
				0,
				0.4,
			],
			[
				6,
				0.92,
			],
		),
	},
	c2: {
		asset: "c",
		text: "Money is paid back by bank transfer.",
		vector: e(
			[
				1,
				0.9,
			],
			[
				0,
				0.44,
			],
		),
	},
	c3: {
		asset: "c",
		text: "The records are kept for seven years.",
		vector: e([
			6,
			1,
		]),
	},
	c4: {
		asset: "c",
		text: "Our refund policy is the same in every branch, opening hours differ.",
		vector: e(
			[
				0,
				0.7,
			],
			[
				2,
				0.7,
			],
		),
	},
	c5: {
		asset: "c",
		text: "Quantum zebra notes.",
		vector: e(
			[
				7,
				0.3,
			],
			[
				6,
				0.95,
			],
		),
	},
	c6: {
		asset: "c",
		text: "Money back for late returns needs the receipt and the refund form.",
		vector: e(
			[
				0,
				0.75,
			],
			[
				1,
				0.4,
			],
			[
				5,
				0.53,
			],
		),
	},
};

export const idOf = (name: string) =>
	`${Buffer.from(name.padEnd(4, "_")).toString("hex").slice(0, 8)}-0000-4000-8000-000000000000`;
export const nameOf = (id: string) =>
	Object.keys(seeds).find((name) => idOf(name) === id);

/** The payload a passage of the corpus is stored with. */
export const payloadOf = (name: string): AssetPointPayload => {
	const seed = seeds[name];
	return {
		source: "text",
		asset_id: assets[seed.asset],
		block_id: blockId,
		text: seed.text,
		depth: 0,
		tokens: 10,
		chunk_index: Object.keys(seeds).indexOf(name),
		chunkCount: Object.keys(seeds).length,
		...(seed.page
			? {
					chunkPageStart: seed.page[0],
					chunkPageEnd: seed.page[1],
				}
			: {}),
		createdAt: "2026-01-01T00:00:00.000Z",
		index_attempt: 1,
		published: true,
	};
};

// One batch, so every passage has the same version.
export const seedCorpus = upsertPointsToQdrant({
	points: Object.entries(seeds).map(([name, seed]) => ({
		id: idOf(name),
		vector: seed.vector,
		payload: payloadOf(name),
	})),
});
