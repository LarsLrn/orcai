import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { RAG_SETTINGS } from "@orcai/core";
import { selectDiversePoints } from "@orcai/qdrant";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { chatSources } from "@/lib/ai/citations/chat-sources";
import { sourceRef } from "@/lib/ai/citations/source-ref";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	answers,
	procedureCalls,
	resetProcedures,
} from "../assistant/test-procedures";
import { assetPoint } from "./test-points";
import type { Passage } from "./types";

const { getPassagesTool } = await import("./get-passages");
const { getAssetPageTool } = await import("./get-asset-page");
const { searchRepositoriesTool } = await import("./search-repositories");

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
	sources: chatSources([]),
};

/** The sources of a chat whose earlier search returned `results`. */
const sourcesOf = (...results: Passage[]) =>
	chatSources([
		{
			parts: [
				{
					type: "tool-searchRepositories",
					state: "output-available",
					output: {
						results,
					},
				} as {
					type: string;
				},
			],
		},
	]);

const options = {
	toolCallId: "call",
	messages: [],
	context: {},
};

const longText = `${"Refunds are paid within fourteen days. ".repeat(25)}End.`;

const points = [
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
		passageIndices?: number[];
	};
};

const searchPoints = ({ filters }: SearchInput) =>
	Effect.succeed({
		data: points.filter(
			(point) =>
				filters.pointIds?.includes(point.id) ??
				filters.passageIndices?.includes(point.payload.chunk_index),
		),
	});

beforeEach(() => {
	answers["block.readiness"] = () =>
		Effect.succeed({
			data: [],
		});
});

afterEach(resetProcedures);

describe("searchRepositories", () => {
	test("returns the full text of each passage", async () => {
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

		const output = await searchRepositoriesTool(deps).execute?.(
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
	test("shows the repository's per-asset selection, recalled for more than it shows", async () => {
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

		const output = await searchRepositoriesTool(deps).execute?.(
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

describe("getPassages", () => {
	test("reads around a point named by its ref as one passage", async () => {
		answers["assetPoint.searchRepository"] = searchPoints;
		const ref = sourceRef("passage", "102");

		const output = await getPassagesTool({
			...deps,
			sources: sourcesOf({
				ref,
				id: "102",
				assetId: "asset-a",
				title: "Refund policy",
				blockName: "Handbook",
				text: "of the request being approved.",
			}),
		}).execute?.(
			{
				passages: [
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

	test("names the passages it could not find, without asking for unknown refs", async () => {
		answers["assetPoint.searchRepository"] = searchPoints;

		const output = await getPassagesTool(deps).execute?.(
			{
				passages: [
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
					ref: sourceRef("passage", "101"),
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

describe("getPassages with an ambiguous ref", () => {
	test("finds nothing for a ref two passages claim", async () => {
		answers["assetPoint.searchRepository"] = searchPoints;
		const passage = {
			ref: "k111111",
			assetId: "asset-a",
			title: "Refund policy",
			blockName: "Handbook",
			text: "Text.",
		};

		const output = await getPassagesTool({
			...deps,
			sources: sourcesOf(
				{
					...passage,
					id: "101",
				},
				{
					...passage,
					id: "102",
				},
			),
		}).execute?.(
			{
				passages: [
					"k111111",
				],
				neighbours: 0,
			},
			options,
		);

		expect(output).toEqual({
			passages: [],
			missing: [
				"k111111",
			],
		});
		expect(procedureCalls).toEqual([]);
	});
});

describe("getAssetPage", () => {
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
						assets: [
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
		getAssetPageTool(deps).execute?.(
			{
				page: 4,
				includeAdjacentPages: 0,
				limit: 12,
			},
			options,
		);

	test("returns the page's passages without the assets it matched", async () => {
		answerCatalog([
			points[0],
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

	test("lists the matched assets when the page has no text", async () => {
		answerCatalog([]);

		expect(await read()).toEqual({
			passages: [],
			matchedAssets: [
				{
					assetId: "asset-a",
					title: "Refund policy",
					state: "ready",
				},
			],
		});
	});
});
