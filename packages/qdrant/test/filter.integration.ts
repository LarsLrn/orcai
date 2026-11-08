import { beforeAll, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { buildQdrantFilter } from "../src/filter";
import { upsertPointsToQdrant } from "../src/mutations";
import { queryAssetPoints } from "../src/queries";
import { SETUP_TIMEOUT, testCollectionRuntime } from "./test-collection";

const run = testCollectionRuntime(2).runPromise;

const blockId = crypto.randomUUID() as BlockId;
const otherBlockId = crypto.randomUUID() as BlockId;
const [a, b, c] = Array.from(
	{
		length: 3,
	},
	() => crypto.randomUUID() as AssetId,
);

const points = {
	a0: {
		assetId: a,
		chunk: 0,
		pages: [
			1,
			1,
		],
	},
	a1: {
		assetId: a,
		chunk: 1,
		pages: [
			2,
			3,
		],
	},
	a2: {
		assetId: a,
		chunk: 2,
		pages: [
			4,
			4,
		],
	},
	b0: {
		assetId: b,
		chunk: 0,
		pages: [
			1,
			2,
		],
	},
	b1: {
		assetId: b,
		chunk: 1,
		pages: [
			3,
			3,
		],
	},
	c0: {
		assetId: c,
		chunk: 0,
		pages: [
			1,
			1,
		],
	},
	otherBlock: {
		assetId: a,
		chunk: 0,
		pages: [
			1,
			1,
		],
		blockId: otherBlockId,
	},
	unpublished: {
		assetId: a,
		chunk: 0,
		pages: [
			1,
			1,
		],
		published: false,
	},
} satisfies Record<
	string,
	{
		assetId: AssetId;
		chunk: number;
		pages: [
			number,
			number,
		];
		blockId?: BlockId;
		published?: boolean;
	}
>;
type Name = keyof typeof points;

const ids = Object.fromEntries(
	Object.keys(points).map((name) => [
		crypto.randomUUID(),
		name as Name,
	]),
);
const idOf = (name: Name) =>
	Object.keys(ids).find((id) => ids[id] === name) as string;

beforeAll(
	() =>
		run(
			upsertPointsToQdrant({
				points: Object.entries(points).map(([name, point]) => ({
					id: idOf(name as Name),
					vector: [
						1,
						0,
					],
					payload: {
						source: "text" as const,
						asset_id: point.assetId,
						block_id: "blockId" in point ? point.blockId : blockId,
						text: name,
						depth: 0,
						tokens: 1,
						chunk_index: point.chunk,
						chunkCount: 3,
						chunkPageStart: point.pages[0],
						chunkPageEnd: point.pages[1],
						createdAt: new Date().toISOString(),
						index_attempt: 1,
						published: "published" in point ? point.published : true,
					},
				})),
			}),
		),
	SETUP_TIMEOUT,
);

const served = async (
	restrictions: Omit<Parameters<typeof buildQdrantFilter>[0], "blockId">,
) =>
	(
		await run(
			queryAssetPoints({
				filter: buildQdrantFilter({
					blockId,
					...restrictions,
				}),
				limit: 100,
			}),
		)
	)
		.map((point) => ids[point.id])
		.sort();

describe("buildQdrantFilter", () => {
	test("restricts to the repository's served points", async () => {
		expect(await served({})).toEqual([
			"a0",
			"a1",
			"a2",
			"b0",
			"b1",
			"c0",
		]);
	});

	test("matches any of several values within a restriction and every restriction", async () => {
		expect(
			await served({
				assetIds: [
					a,
					b,
				],
				chunkIndices: [
					0,
					1,
				],
			}),
		).toEqual([
			"a0",
			"a1",
			"b0",
			"b1",
		]);
	});

	test("keeps the passages overlapping a page", async () => {
		expect(
			await served({
				page: 2,
			}),
		).toEqual([
			"a1",
			"b0",
		]);
	});

	test("keeps the passages overlapping a page range", async () => {
		expect(
			await served({
				assetIds: [
					a,
				],
				pageFrom: 3,
				pageTo: 4,
			}),
		).toEqual([
			"a1",
			"a2",
		]);
	});

	test("restricts to the given points", async () => {
		expect(
			await served({
				pointIds: [
					idOf("a2"),
					idOf("c0"),
					idOf("otherBlock"),
				],
			}),
		).toEqual([
			"a2",
			"c0",
		]);
	});
});
