import { describe, expect, test } from "bun:test";
import {
	answerable,
	type Found,
	outcomeOf,
	rankOf,
	type Source,
	summarize,
} from "./metrics";

const passage = (
	document: string,
	text: string,
	pageStart?: number,
	pageEnd = pageStart,
): Found => ({
	document,
	source: "text",
	text,
	pageStart,
	pageEnd,
});

describe("rankOf", () => {
	test("finds evidence across line breaks, table pipes and glued words", () => {
		const fee: Source[] = [
			{
				document: "guide",
				page: 2,
				evidence: "Regelbedarfsstufe 1",
			},
		];
		expect(
			rankOf(
				[
					passage("guide", "Nothing here", 1),
					passage("guide", "| Regel- | bedarfsstufe 1 |\n| 563 Euro |", 2),
				],
				fee,
			),
		).toBe(2);
		expect(
			rankOf(
				[
					passage("apa", "an originalresearch article", 3),
				],
				[
					{
						document: "apa",
						page: 3,
						evidence: "original research",
					},
				],
			),
		).toBe(1);
	});

	test("counts evidence only in a source's document, any source", () => {
		const sources: Source[] = [
			{
				document: "de",
				page: 4,
				evidence: "0,887",
			},
			{
				document: "en",
				page: 4,
				evidence: "0.887",
			},
		];
		expect(
			rankOf(
				[
					passage("other", "0,887", 4),
					passage("en", "alpha = 0.887", 4),
				],
				sources,
			),
		).toBe(2);
		expect(
			rankOf(
				[
					passage("other", "0,887", 4),
				],
				sources,
			),
		).toBeNull();
	});

	test("answers a figure question with a figure of the expected page", () => {
		const figure: Found = {
			document: "report",
			source: "image",
			text: "A bar chart",
			pageStart: 3,
			pageEnd: 3,
		};
		const chart: Source[] = [
			{
				document: "report",
				page: 3,
				figure: true,
			},
		];
		expect(
			rankOf(
				[
					passage("report", "A bar chart", 3),
					figure,
				],
				chart,
			),
		).toBe(2);
		expect(
			rankOf(
				[
					{
						...figure,
						pageStart: 4,
						pageEnd: 4,
					},
				],
				chart,
			),
		).toBeNull();
	});
});

test("a table row counts only with its label and value in one passage", () => {
	const fee: Source[] = [
		{
			document: "report",
			page: 2,
			evidence: [
				"Kaution für ein Standrohr",
				"400,00",
			],
		},
	];
	expect(
		rankOf(
			[
				passage("report", "| Kaution für ein Standrohr | einmalig |", 2),
				passage("report", "| 400,00 € | 400,00 € |", 2),
				passage(
					"report",
					"| Kaution für ein Standrohr | einmalig | 400,00 € |",
					2,
				),
			],
			fee,
		),
	).toBe(3);
});

test("answerable tells extraction losses from retrieval misses", () => {
	const sources: Source[] = [
		{
			document: "scan",
			page: 1,
			evidence: "über die Reinigung",
		},
	];
	expect(
		answerable(
			[
				passage("scan", "iiber die Reinigung"),
			],
			sources,
		),
	).toBe(false);
	expect(
		answerable(
			[
				passage("scan", "über die Reinigung"),
			],
			sources,
		),
	).toBe(true);
});

test("page at 1 needs a first result that answers on the expected page", () => {
	const sources: Source[] = [
		{
			document: "guide",
			page: [
				2,
				9,
			],
			evidence: "fee",
		},
	];
	expect(
		outcomeOf(
			[
				passage("guide", "a fee", 1, 3),
			],
			sources,
		).pageRight,
	).toBe(true);
	expect(
		outcomeOf(
			[
				passage("guide", "other", 2),
				passage("guide", "a fee", 2),
			],
			sources,
		).pageRight,
	).toBe(false);
	expect(
		outcomeOf(
			[
				passage("guide", "fee"),
			],
			sources,
		),
	).toEqual({
		rank: 1,
		pageRight: false,
	});
});

test("summarize gives hit rates, MRR and page at 1", () => {
	expect(
		summarize([
			{
				rank: 1,
				pageRight: true,
			},
			{
				rank: 2,
				pageRight: false,
			},
			{
				rank: null,
				pageRight: false,
			},
			{
				rank: 4,
				pageRight: true,
			},
		]),
	).toEqual({
		questions: 4,
		hitAt1: 0.25,
		hitAt3: 0.5,
		hitAtLimit: 0.75,
		mrr: (1 + 0.5 + 0.25) / 4,
		pageAt1: 0.5,
	});
});
