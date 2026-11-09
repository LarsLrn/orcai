import { beforeAll, describe, expect, test } from "bun:test";
import type { RetrievalMode } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { EmbeddingGeneration } from "../src/generation";
import { prepareQueries, retrievePassages } from "../src/retrieve";
import {
	assets,
	blockId,
	DIM,
	idOf,
	nameOf,
	payloadOf,
	queryVectors,
	seedCorpus,
} from "./retrieval-corpus";
import { SETUP_TIMEOUT, testCollectionRuntime } from "./test-collection";

const run = testCollectionRuntime(DIM).runPromise;

beforeAll(() => run(seedCorpus), SETUP_TIMEOUT);

const every = Object.values(assets);

type Search = Omit<Parameters<typeof retrievePassages>[0], "queries"> & {
	queries?: string[];
};

/**
 * The search's points as `[name, score]` in rank order, with its metadata,
 * once each point is shown to be the stored passage: its payload, no vector,
 * and the version of the one batch that wrote the corpus, or 0 unranked.
 */
const search = async ({ queries = [], scope, policy }: Search) => {
	const result = await run(
		retrievePassages({
			queries: queries.map((text) => ({
				text,
				vector:
					policy.retrievalMode === "sparse" ? undefined : queryVectors[text],
			})),
			scope,
			policy,
		}),
	);
	const versions = new Set(result.data.map((point) => point.version));
	for (const point of result.data) {
		expect(point.payload).toEqual(payloadOf(nameOf(point.id) as string));
		expect(point.vector).toBeUndefined();
		if (queries.length > 0) expect(point.version).toBeGreaterThan(0);
		else expect(point.version).toBe(0);
	}
	expect(versions.size).toBeLessThanOrEqual(1);
	return {
		points: result.data.map((point) => [
			nameOf(point.id),
			point.score,
		]),
		metadata: result.metadata,
	};
};

const scope = (assetIds: readonly string[] = every) => ({
	blockId,
	assetIds,
});

describe("retrievePassages", () => {
	test("dense ranks by similarity", async () => {
		const { points, metadata } = await search({
			queries: [
				"refund policy",
			],
			scope: scope(),
			policy: {
				retrievalMode: "dense",
				limit: 4,
			},
		});
		expect(points.map(([name]) => name)).toEqual([
			"a1",
			"a2",
			"b4",
			"c6",
		]);
		expect(points[0][1]).toBeCloseTo(0.950666, 5);
		expect(metadata).toEqual({
			retrievalMode: "dense",
			candidateCount: 16,
			returnedCount: 4,
		});
	});

	test("sparse keeps the keyword matches in the order Qdrant ranks them", async () => {
		const { points, metadata } = await search({
			queries: [
				"refund policy",
			],
			scope: scope(),
			policy: {
				retrievalMode: "sparse",
				limit: 5,
			},
		});
		expect(points.map(([name]) => name)).toEqual([
			"a1",
			"b4",
			"c4",
			"c1",
			"a2",
		]);
		expect(metadata).toEqual({
			retrievalMode: "sparse",
			candidateCount: 7,
			returnedCount: 5,
		});
	});

	test("hybrid ranks a point both meaning and keywords find first", async () => {
		const { points } = await search({
			queries: [
				"refund policy",
			],
			scope: scope(),
			policy: {
				retrievalMode: "hybrid",
				limit: 5,
			},
		});
		expect(points.map(([name]) => name)).toEqual([
			"a1",
			"b4",
			"a2",
			"c4",
			"c6",
		]);
	});

	test("a point several wordings rank high comes before the best match of one", async () => {
		const ranked = async (queries: string[]) =>
			(
				await search({
					queries,
					scope: scope(),
					policy: {
						retrievalMode: "dense",
						limit: 2,
					},
				})
			).points.map(([name]) => name);
		expect(
			await ranked([
				"money back",
			]),
		).toEqual([
			"a3",
			"a1",
		]);
		expect(
			await ranked([
				"refund policy",
				"money back",
			]),
		).toEqual([
			"a1",
			"a3",
		]);
	});

	test("repeating a wording does not boost the points it finds", async () => {
		const policy = {
			retrievalMode: "dense",
			limit: 6,
			maxPerAsset: 6,
		} as const;
		expect(
			await search({
				queries: [
					"refund policy",
					"refund policy",
					"money back",
				],
				scope: scope(),
				policy,
			}),
		).toEqual(
			await search({
				queries: [
					"refund policy",
					"money back",
				],
				scope: scope(),
				policy,
			}),
		);
	});

	test("keeps to the scope's assets, pages and passages", async () => {
		const someAssets = await search({
			queries: [
				"refund policy",
			],
			scope: scope([
				assets.b,
				assets.c,
			]),
			policy: {
				retrievalMode: "dense",
				limit: 3,
				candidateLimit: 2,
			},
		});
		expect(someAssets.points.map(([name]) => name)).toEqual([
			"b4",
			"c6",
			"c4",
		]);

		const pages = await search({
			queries: [
				"parking",
			],
			scope: {
				...scope([
					assets.b,
				]),
				pageFrom: 2,
				pageTo: 3,
			},
			policy: {
				retrievalMode: "hybrid",
				limit: 5,
			},
		});
		// b3 and b4 tie on keywords, so only the pages' passages are certain.
		expect(pages.points.map(([name]) => name).sort()).toEqual([
			"b3",
			"b4",
			"b5",
		]);

		const passages = await search({
			queries: [
				"refund policy",
			],
			scope: {
				...scope(),
				passageIndices: [
					0,
					1,
					6,
					8,
					9,
				],
			},
			policy: {
				retrievalMode: "dense",
				limit: 4,
			},
		});
		expect(passages.points.map(([name]) => name)).toEqual([
			"a1",
			"a2",
			"b4",
			"b5",
		]);
	});

	test("without queries returns the scope's points, in the order of the ids given", async () => {
		const { points, metadata } = await search({
			scope: {
				...scope(),
				pointIds: [
					idOf("c3"),
					idOf("a1"),
					idOf("b2"),
				],
			},
			policy: {
				limit: 5,
			},
		});
		expect(points).toEqual([
			[
				"c3",
				0,
			],
			[
				"a1",
				0,
			],
			[
				"b2",
				0,
			],
		]);
		expect(metadata.candidateCount).toBe(3);
	});

	test("an empty scope finds nothing", async () => {
		expect(
			await search({
				queries: [
					"refund policy",
				],
				scope: scope([]),
				policy: {
					retrievalMode: "hybrid",
				},
			}),
		).toEqual({
			points: [],
			metadata: {
				retrievalMode: "hybrid",
				candidateCount: 0,
				returnedCount: 0,
			},
		});
	});
});

describe("prepareQueries", () => {
	const prepare = async (
		searches: {
			queries: string[];
			retrievalMode: RetrievalMode;
		}[],
	) => {
		const requests: string[][] = [];
		const prepared = await Effect.runPromise(
			prepareQueries(searches).pipe(
				Effect.provideService(
					EmbeddingGeneration,
					EmbeddingGeneration.of({
						generation: 1,
						model: "test",
						dimensions: 1,
						collection: "test",
						embedQueries: (queries) =>
							Effect.sync(() => {
								requests.push([
									...queries,
								]);
								return queries.map((query) => [
									query.charCodeAt(0),
								]);
							}),
						embedPassages: () => Effect.die("unused"),
					}),
				),
			),
		);
		return {
			prepared,
			requests,
		};
	};

	test("embeds the distinct wordings of every dense or hybrid search in one request", async () => {
		const { prepared, requests } = await prepare([
			{
				queries: [
					"a",
					"b",
				],
				retrievalMode: "hybrid",
			},
			{
				queries: [
					"c",
				],
				retrievalMode: "sparse",
			},
			{
				queries: [
					"b",
					"d",
				],
				retrievalMode: "dense",
			},
		]);
		expect(requests).toEqual([
			[
				"a",
				"b",
				"d",
			],
		]);
		expect(prepared).toEqual([
			[
				{
					text: "a",
					vector: [
						97,
					],
				},
				{
					text: "b",
					vector: [
						98,
					],
				},
			],
			[
				{
					text: "c",
				},
			],
			[
				{
					text: "b",
					vector: [
						98,
					],
				},
				{
					text: "d",
					vector: [
						100,
					],
				},
			],
		]);
	});

	test("embeds nothing for sparse searches", async () => {
		const { prepared, requests } = await prepare([
			{
				queries: [
					"a",
				],
				retrievalMode: "sparse",
			},
		]);
		expect(requests).toEqual([]);
		expect(prepared).toEqual([
			[
				{
					text: "a",
				},
			],
		]);
	});
});
