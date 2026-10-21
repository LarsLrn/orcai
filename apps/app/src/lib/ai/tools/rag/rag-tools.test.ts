import { afterEach, describe, expect, test } from "bun:test";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, resetProcedures } from "../assistant/test-procedures";
import { assetPoint } from "./test-points";

const { getKnowledgeBaseChunksTool } = await import(
	"./get-knowledge-base-chunk"
);
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
};

const options = {
	toolCallId: "call",
	messages: [],
	context: {},
};

const longText = `${"Refunds are paid within fourteen days. ".repeat(25)}End.`;

const chunks = [
	assetPoint({
		id: "c1",
		index: 1,
		text: "Chapter 3. Refunds. Refunds are paid within 14 days of the request being approved.",
		pageStart: 4,
	}),
	assetPoint({
		id: "c2",
		index: 2,
		text: "of the request being approved. Late refunds earn interest at 2%.",
		pageStart: 4,
		pageEnd: 5,
	}),
	assetPoint({
		id: "c3",
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
});

describe("getKnowledgeBaseChunks", () => {
	test("reads a chunk with its neighbours as one passage", async () => {
		answers["assetPoint.searchRepository"] = searchChunks;

		const output = await getKnowledgeBaseChunksTool(deps).execute?.(
			{
				chunks: [
					"c2",
				],
				neighbours: 1,
			},
			options,
		);

		expect(output).toMatchObject({
			passages: [
				{
					text: "Chapter 3. Refunds. Refunds are paid within 14 days of the request being approved. Late refunds earn interest at 2%.\n\nInterest is paid with the refund.",
					source: {
						chunk: {
							pageStart: 4,
							pageEnd: 5,
						},
					},
				},
			],
		});
	});

	test("names the chunks it could not find", async () => {
		answers["assetPoint.searchRepository"] = searchChunks;

		const output = await getKnowledgeBaseChunksTool(deps).execute?.(
			{
				chunks: [
					"c1",
					"gone",
				],
				neighbours: 0,
			},
			options,
		);

		expect(output).toMatchObject({
			passages: [
				{
					id: "c1",
				},
			],
			missing: [
				"gone",
			],
		});
	});
});
