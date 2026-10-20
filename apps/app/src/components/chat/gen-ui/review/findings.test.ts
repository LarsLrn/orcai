import { describe, expect, test } from "bun:test";
import {
	anchorFindings,
	itemStatus,
	reviewOf,
	type StreamedFinding,
	stripEmphasis,
} from "@/components/chat/gen-ui/review/findings";
import type { Status } from "@/components/chat/gen-ui/status";

describe("itemStatus", () => {
	test.each<
		[
			string,
			StreamedFinding[],
			Status | undefined,
		]
	>([
		[
			"an error",
			[
				{
					severity: "warning",
				},
				{
					severity: "error",
				},
			],
			"not_met",
		],
		[
			"a warning",
			[
				{
					severity: "info",
				},
				{
					severity: "warning",
				},
			],
			"partial",
		],
		[
			"info only",
			[
				{
					severity: "info",
				},
			],
			"met",
		],
		[
			"no findings",
			[],
			"met",
		],
		[
			"an error beside a severity still streaming",
			[
				{
					severity: "error",
				},
				{
					label: "Authors",
				},
			],
			"not_met",
		],
		[
			"a warning beside a severity still streaming",
			[
				{
					severity: "warning",
				},
				{
					label: "Authors",
				},
			],
			undefined,
		],
	])("derives the status from %s", (_, findings, status) => {
		expect(itemStatus(findings)).toBe(status);
	});

	test("is pending while the findings have not arrived", () => {
		expect(itemStatus(undefined)).toBeUndefined();
	});
});

describe("anchorFindings", () => {
	const text = "Hattie, J. and Timperley, H. (2007). The Power of Feedback.";

	test("numbers excerpts in text order, not finding order", () => {
		expect(
			anchorFindings(text, [
				{
					excerpt: "The Power of Feedback",
				},
				{
					excerpt: "Hattie, J. and Timperley, H.",
				},
			]),
		).toEqual([
			{
				finding: 1,
				start: 0,
				end: 28,
				number: 1,
			},
			{
				finding: 0,
				start: 37,
				end: 58,
				number: 2,
			},
		]);
	});

	test("leaves out excerpts missing from the text, empty or absent", () => {
		expect(
			anchorFindings(text, [
				{
					excerpt: "(Hattie et al., 2007)",
				},
				{
					excerpt: "",
				},
				{},
				{
					excerpt: "(2007)",
				},
			]).map(({ finding, number }) => [
				finding,
				number,
			]),
		).toEqual([
			[
				3,
				1,
			],
		]);
	});

	test("leaves out an excerpt that overlaps an earlier one", () => {
		expect(
			anchorFindings(text, [
				{
					excerpt: "Timperley, H. (2007)",
				},
				{
					excerpt: "Hattie, J. and Timperley",
				},
				{
					excerpt: "Feedback",
				},
			]).map(({ finding, number }) => [
				finding,
				number,
			]),
		).toEqual([
			[
				1,
				1,
			],
			[
				2,
				2,
			],
		]);
	});
});

describe("reviewOf", () => {
	test("leaves out malformed entries and cut-off severities", () => {
		expect(
			reviewOf({
				title: {
					text: "APA",
				},
				summary: "",
				items: [
					"a string item",
					null,
					{
						label: "Hattie",
						text: 7,
						findings: [
							null,
							{
								label: "Authors",
								severity: "err",
								excerpt: [
									"Hattie",
								],
							},
						],
					},
					{
						label: "Shute",
						findings: "not a list",
					},
				],
				general: {
					label: "Not a list",
				},
			}),
		).toEqual({
			title: undefined,
			summary: undefined,
			items: [
				{
					label: "Hattie",
					text: undefined,
					revised: undefined,
					findings: [
						{
							label: "Authors",
							severity: undefined,
							note: undefined,
							excerpt: undefined,
						},
					],
				},
				{
					label: "Shute",
					text: undefined,
					revised: undefined,
					findings: undefined,
				},
			],
			general: [],
		});
		expect(reviewOf("not an object").items).toEqual([]);
	});
});

test("stripEmphasis drops asterisks", () => {
	expect(stripEmphasis("*Review*, **77**(1)")).toBe("Review, 77(1)");
});
