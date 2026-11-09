import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AssetPoint, Repository } from "@orcai/schema";
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
	] as unknown as Repository[],
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
	...[
		{
			id: "201",
			index: 4,
			text: "Bar chart of refunds per month.",
			pageStart: 4,
		},
		{
			id: "202",
			index: 5,
			text: "Photo of the refund desk.",
			pageStart: 9,
		},
		// More images on page 7 than one page lookup returns, ahead of its text.
		...Array.from(
			{
				length: 8,
			},
			(_, offset) => ({
				id: `${401 + offset}`,
				index: 6 + offset,
				text: `Photo ${offset + 1} of the branch.`,
				pageStart: 7,
			}),
		),
	].map((fields) => {
		const point = assetPoint(fields);
		return {
			...point,
			payload: {
				...point.payload,
				source: "image" as const,
			},
		};
	}),
	assetPoint({
		id: "301",
		index: 14,
		text: "The branch opened in 2019.",
		pageStart: 7,
	}),
];

type SearchInput = {
	filters: {
		pointIds?: string[];
		passageIndices?: number[];
		page?: number;
		source?: "text" | "image";
		limit?: number;
	};
};

const onPage = (point: AssetPoint, page: number) =>
	(point.payload.chunkPageStart ?? Number.POSITIVE_INFINITY) <= page &&
	page <= (point.payload.chunkPageEnd ?? Number.NEGATIVE_INFINITY);

const searchPoints = ({ filters }: SearchInput) =>
	Effect.succeed({
		data: points
			.filter(
				(point) =>
					(filters.pointIds?.includes(point.id) ??
						filters.passageIndices?.includes(point.payload.chunk_index) ??
						(filters.page !== undefined && onPage(point, filters.page))) &&
					(filters.source === undefined ||
						point.payload.source === filters.source),
			)
			.slice(0, filters.limit),
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
		answers["assetPoint.searchRepositories"] = () =>
			Effect.succeed({
				results: [
					{
						data: [
							assetPoint({
								id: "c9",
								index: 9,
								text: longText,
							}),
						] satisfies AssetPoint[],
					},
				],
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
	test("searches every repository in one request, however many there are", async () => {
		const blocks = Array.from(
			{
				length: 150,
			},
			(_, index) => ({
				id: `block-${index}`,
				name: `Repository ${index}`,
				config: {},
			}),
		) as unknown as Repository[];
		answers["assetPoint.searchRepositories"] = ({
			searches,
		}: {
			searches: unknown[];
		}) =>
			Effect.succeed({
				results: searches.map(() => ({
					data: [],
				})),
			});

		await searchRepositoriesTool({
			...deps,
			blocks,
		}).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		const searches = procedureCalls.filter(
			({ procedure }) => procedure === "assetPoint.searchRepositories",
		);
		expect(searches).toHaveLength(1);
		const [{ input }] = searches as unknown as [
			{
				input: {
					searches: {
						repositoryId: string;
					}[];
				};
			},
		];
		expect(input.searches.map(({ repositoryId }) => repositoryId)).toEqual(
			blocks.map(({ id }) => id),
		);
	});

	test("shows the repository's selection in its order", async () => {
		const selected = [
			...[
				0,
				1,
				2,
				3,
			].map((index) => ({
				...assetPoint({
					id: `a${index}`,
					index,
				}),
				score: 0.9 - index / 100,
			})),
			...[
				0,
				1,
			].map((index) => ({
				...assetPoint({
					id: `b${index}`,
					index,
					assetId: "asset-b",
				}),
				score: 0.6 - index / 100,
			})),
		];
		answers["assetPoint.searchRepositories"] = () =>
			Effect.succeed({
				results: [
					{
						data: selected,
					},
				],
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
			searches: [
				{
					filters: {
						limit: 6,
					},
				},
			],
		});
	});

	test("merges repositories by rank, since their scores do not compare", async () => {
		const ranked = (prefix: string, scores: number[]) =>
			scores.map((score, index) => ({
				...assetPoint({
					id: `${prefix}${index}`,
					index,
				}),
				score,
			}));
		answers["assetPoint.searchRepositories"] = () =>
			Effect.succeed({
				results: [
					{
						data: ranked(
							"high",
							[
								0.9,
								0.8,
								0.7,
							],
						),
					},
					{
						data: ranked(
							"low",
							[
								0.03,
								0.02,
							],
						),
					},
				],
			});

		const output = await searchRepositoriesTool({
			...deps,
			blocks: [
				{
					id: "block-1",
					name: "Handbook",
					config: {},
				},
				{
					id: "block-2",
					name: "Minutes",
					config: {},
				},
			] as unknown as Repository[],
		}).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		expect(
			(
				output as {
					results: Passage[];
				}
			).results.map(({ id, blockName }) => [
				id,
				blockName,
			]),
		).toEqual([
			[
				"high0",
				"Handbook",
			],
			[
				"low0",
				"Minutes",
			],
			[
				"high1",
				"Handbook",
			],
			[
				"low1",
				"Minutes",
			],
			[
				"high2",
				"Handbook",
			],
		]);
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

	test("reads the text on an image description's page, not the images indexed next to it", async () => {
		answers["assetPoint.searchRepository"] = searchPoints;

		const output = (await getPassagesTool(deps).execute?.(
			{
				passages: [
					"201",
				],
				neighbours: 1,
			},
			options,
		)) as {
			passages: Passage[];
		};

		expect(
			output.passages.map(({ id, kind, text }) => ({
				id,
				kind,
				text,
			})),
		).toEqual([
			{
				id: "201",
				kind: "figure",
				text: "Bar chart of refunds per month.",
			},
			{
				id: "101",
				kind: undefined,
				text: "Chapter 3. Refunds. Refunds are paid within 14 days of the request being approved. Late refunds earn interest at 2%.",
			},
		]);
	});

	test("finds the page's text around an image description however many images share the page", async () => {
		answers["assetPoint.searchRepository"] = searchPoints;

		const output = (await getPassagesTool(deps).execute?.(
			{
				passages: [
					"401",
				],
				neighbours: 1,
			},
			options,
		)) as {
			passages: Passage[];
		};

		expect(output.passages.map(({ id }) => id)).toEqual([
			"401",
			"301",
		]);
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
