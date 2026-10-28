import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { RAG_SETTINGS } from "@orcai/core";
import { selectDiversePoints } from "@orcai/qdrant";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	answers,
	procedureCalls,
	resetProcedures,
} from "../assistant/test-procedures";
import { chunkIds, chunkRef } from "./chunk-ref";
import { assetPoint } from "./test-points";

const { getKnowledgeBaseChunksTool } = await import(
	"./get-knowledge-base-chunk"
);
const { getKnowledgeBasePageTool } = await import("./get-knowledge-base-page");
const { searchKnowledgeBaseTool } = await import("./search-knowledge-base");

const deps = {
	blocks: [
		{
			id: "block-1",
			name: "Handbook",
			config: {},
		},
	] as unknown as DatabaseBlock[],
	context: {
		secureCookies: false,
	} as ORPCContext,
	chunks: chunkIds([]),
};

const options = {
	toolCallId: "call",
	messages: [],
	context: {},
};

const longText = `${"Refunds are paid within fourteen days. ".repeat(25)}End.`;

const chunks = [
	assetPoint({
		id: "101",
		index: 1,
		text: "Chapter 3. Refunds. Refunds are paid within 14 days of the request being approved.",
		pageStart: 4,
	}),
	assetPoint({
		id: "102",
		index: 2,
		text: "of the request being approved. Late refunds earn interest at 2%.",
		pageStart: 4,
		pageEnd: 5,
	}),
	assetPoint({
		id: "103",
		index: 3,
		text: "Interest is paid with the refund.",
		pageStart: 5,
	}),
];

type SearchInput = {
	filters: {
		pointIds?: string[];
		chunkIndices?: number[];
	};
};

const searchChunks = ({ filters }: SearchInput) =>
	Effect.succeed({
		data: chunks.filter(
			(chunk) =>
				filters.pointIds?.includes(chunk.id) ??
				filters.chunkIndices?.includes(chunk.payload.chunk_index),
		),
	});

beforeEach(() => {
	answers["block.readiness"] = () =>
		Effect.succeed({
			data: [],
		});
});

afterEach(resetProcedures);

describe("searchKnowledgeBase", () => {
	test("returns the full text of each chunk", async () => {
		answers["assetPoint.searchRepository"] = () =>
			Effect.succeed({
				data: [
					assetPoint({
						id: "c9",
						index: 9,
						text: longText,
					}),
				] satisfies AssetPoint[],
			});

		const output = await searchKnowledgeBaseTool(deps).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		expect(
			(
				output as {
					results: {
						text: string;
					}[];
				}
			).results.map((result) => result.text),
		).toEqual([
			longText,
		]);
	});
	test("shows the repository's per-document selection, recalled for more than it shows", async () => {
		const ranked = [
			...Array.from(
				{
					length: 8,
				},
				(_, index) => ({
					...assetPoint({
						id: `a${index}`,
						index,
					}),
					score: 0.9 - index / 100,
				}),
			),
			...Array.from(
				{
					length: 2,
				},
				(_, index) => ({
					...assetPoint({
						id: `b${index}`,
						index,
						assetId: "asset-b",
					}),
					score: 0.6 - index / 100,
				}),
			),
		];
		answers["assetPoint.searchRepository"] = ({
			filters,
		}: {
			filters: {
				limit: number;
				maxPerAsset?: number;
			};
		}) =>
			Effect.succeed({
				data: selectDiversePoints(ranked, {
					limit: filters.limit,
					maxPerAsset: filters.maxPerAsset ?? RAG_SETTINGS.maxPerAsset,
				}),
			});

		const output = await searchKnowledgeBaseTool(deps).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		expect(
			(
				output as {
					results: {
						id: string;
					}[];
				}
			).results.map((result) => result.id),
		).toEqual([
			"a0",
			"a1",
			"a2",
			"a3",
			"b0",
			"b1",
		]);
		expect(procedureCalls[0]?.input).toMatchObject({
			filters: {
				limit: 6,
				recallLimit: 36,
			},
		});
	});
});

describe("getKnowledgeBaseChunks", () => {
	test("reads around a chunk named by its ref as one passage", async () => {
		answers["assetPoint.searchRepository"] = searchChunks;
		const ref = chunkRef("102");

		const output = await getKnowledgeBaseChunksTool({
			...deps,
			chunks: chunkIds([
				{
					ref,
					id: "102",
					assetId: "asset-a",
					title: "Refund policy",
					blockName: "Handbook",
					text: "of the request being approved.",
				},
			]),
		}).execute?.(
			{
				chunks: [
					ref,
				],
				neighbours: 1,
			},
			options,
		);

		expect(output).toEqual({
			passages: [
				{
					ref,
					id: "102",
					assetId: "asset-a",
					title: "Refund policy",
					blockName: "Handbook",
					pageStart: 4,
					pageEnd: 5,
					totalPages: 20,
					text: "Chapter 3. Refunds. Refunds are paid within 14 days of the request being approved. Late refunds earn interest at 2%.\n\nInterest is paid with the refund.",
				},
			],
		});
	});

	test("names the chunks it could not find, without asking for unknown refs", async () => {
		answers["assetPoint.searchRepository"] = searchChunks;

		const output = await getKnowledgeBaseChunksTool(deps).execute?.(
			{
				chunks: [
					"101",
					"k999999",
				],
				neighbours: 0,
			},
			options,
		);

		expect(output).toMatchObject({
			passages: [
				{
					ref: chunkRef("101"),
					id: "101",
				},
			],
			missing: [
				"k999999",
			],
		});
		expect(procedureCalls[0]?.input).toMatchObject({
			filters: {
				pointIds: [
					"101",
				],
			},
		});
	});
});

describe("getKnowledgeBasePage", () => {
	const answerCatalog = (pages: AssetPoint[]) => {
		answers["block.readiness"] = () =>
			Effect.succeed({
				data: [
					{
						blockId: "block-1",
						name: "Handbook",
						totals: {
							total: 1,
							ready: 1,
							preparing: 0,
							failed: 0,
						},
						documents: [
							{
								assetId: "asset-a",
								title: "Refund policy",
								state: "ready",
								failure: null,
							},
						],
					},
				],
			});
		answers["asset.list"] = () =>
			Effect.succeed({
				data: [
					{
						id: "asset-a",
						title: "Refund policy",
						metadata: null,
					},
				],
			});
		answers["assetPoint.searchRepository"] = () =>
			Effect.succeed({
				data: pages,
			});
	};

	const read = () =>
		getKnowledgeBasePageTool(deps).execute?.(
			{
				page: 4,
				includeAdjacentPages: 0,
				limit: 12,
			},
			options,
		);

	test("returns the page's passages without the documents it matched", async () => {
		answerCatalog([
			chunks[0],
		]);

		expect(await read()).toEqual({
			passages: [
				expect.objectContaining({
					id: "101",
					pageStart: 4,
				}),
			],
		});
	});

	test("lists the matched documents when the page has no text", async () => {
		answerCatalog([]);

		expect(await read()).toEqual({
			passages: [],
			matchedDocuments: [
				{
					assetId: "asset-a",
					title: "Refund policy",
					state: "ready",
				},
			],
		});
	});
});
