import { describe, expect, test } from "bun:test";
import {
	chunksModelOutput,
	listModelOutput,
	pageModelOutput,
	searchModelOutput,
} from "./outputs";
import type { Passage } from "./types";

const passage = (fields: Partial<Passage> = {}): Passage => ({
	ref: "k000001",
	id: "c1",
	assetId: "asset-a",
	title: "Refund policy",
	blockName: "Handbook",
	pageStart: 4,
	pageEnd: 4,
	totalPages: 20,
	text: "Refunds are paid within 14 days.",
	...fields,
});

const text = (output: { type: string; value?: unknown }) => output.value;

describe("knowledge base model output", () => {
	test("search reads as one block per passage", () => {
		expect(
			text(
				searchModelOutput({
					output: {
						results: [
							passage(),
							passage({
								ref: "k000007",
								id: "c7",
								title: "Travel policy",
								pageStart: 2,
								pageEnd: 3,
								text: "Book trains over flights.",
							}),
							passage({
								ref: "k000009",
								id: "c9",
								pageStart: undefined,
								pageEnd: undefined,
								text: "No pages here.",
							}),
						],
					},
				}),
			),
		).toBe(
			[
				"[k000001] Refund policy, p. 4",
				"Refunds are paid within 14 days.",
				"",
				"[k000007] Travel policy, pp. 2-3",
				"Book trains over flights.",
				"",
				"[k000009] Refund policy",
				"No pages here.",
			].join("\n"),
		);
	});

	test("a search without results says so", () => {
		expect(
			text(
				searchModelOutput({
					output: {
						results: [],
					},
				}),
			),
		).toBe("No matching passages.");
	});

	test("chunks name what was not found", () => {
		expect(
			text(
				chunksModelOutput({
					output: {
						passages: [
							passage(),
						],
						missing: [
							"gone",
						],
					},
				}),
			),
		).toBe(
			[
				"[k000001] Refund policy, p. 4",
				"Refunds are paid within 14 days.",
				"",
				"Not found: gone",
			].join("\n"),
		);
	});

	test("a page read without text lists the matching documents", () => {
		expect(
			text(
				pageModelOutput({
					output: {
						passages: [],
						matchedDocuments: [
							{
								assetId: "asset-a",
								title: "Refund policy",
								citation: "Finance, 2024",
							},
						],
					},
				}),
			),
		).toBe(
			[
				"No matching passages.",
				"",
				"Matching documents:",
				"- asset-a: Refund policy (Finance, 2024)",
			].join("\n"),
		);
	});

	test("documents read as one line each", () => {
		expect(
			text(
				listModelOutput({
					output: {
						documents: [
							{
								assetId: "asset-a",
								title: "Refund policy",
							},
						],
					},
				}),
			),
		).toBe("- asset-a: Refund policy");
	});

	test("an output of an older shape is no longer available", () => {
		const old = {
			results: [
				{
					id: "c1",
					title: "Refund policy",
					snippet: "refunds are paid within 14 days",
					source: {},
				},
			],
			nextAction: "getKnowledgeBaseChunks",
		};

		expect(
			searchModelOutput({
				output: old,
			}),
		).toEqual({
			type: "text",
			value: "Output no longer available",
		});
		expect(
			text(
				chunksModelOutput({
					output: {
						chunks: [],
					},
				}),
			),
		).toBe("Output no longer available");
	});
});
