import { describe, expect, test } from "bun:test";
import { applyMetadataSuggestion, metadataReviewFields } from "../src";

const suggestion = {
	title: "Refund policy 2026",
	metadata: {
		sourceType: "journal-article" as const,
		author: "Ada Lovelace",
		citation: "Lovelace, A. (2026). Refunds. Journal of Policy, 4(2), 1-9.",
		journalName: "Journal of Policy",
		description: "How refunds are paid.",
		language: "en",
	},
};

describe("applyMetadataSuggestion", () => {
	test("fills empty fields and replaces a title that is still the file name", () => {
		const applied = applyMetadataSuggestion(
			{
				title: "refunds.pdf",
				fileName: "refunds.pdf",
				metadata: {
					author: "Kept Author",
					citation: "",
				},
			},
			suggestion,
		);

		expect(applied).toEqual({
			title: "Refund policy 2026",
			metadata: {
				sourceType: "journal-article",
				author: "Kept Author",
				citation: suggestion.metadata.citation,
				journalName: "Journal of Policy",
				description: "How refunds are paid.",
				language: "en",
			},
			review: null,
		});
	});

	test("keeps a title someone changed, and every title when the file name is unknown", () => {
		expect(
			applyMetadataSuggestion(
				{
					title: "My title",
					fileName: "refunds.pdf",
					metadata: {},
				},
				suggestion,
			).title,
		).toBe("My title");
		expect(
			applyMetadataSuggestion(
				{
					title: "refunds.pdf",
					fileName: null,
					metadata: {},
				},
				suggestion,
			).title,
		).toBe("refunds.pdf");
	});

	test("keeps fields of another source type for review", () => {
		const applied = applyMetadataSuggestion(
			{
				title: "A book",
				fileName: "a.pdf",
				metadata: {
					sourceType: "book",
				},
			},
			suggestion,
		);

		expect(applied.metadata).toEqual({
			sourceType: "book",
			description: "How refunds are paid.",
			language: "en",
		});
		expect(applied.review).toEqual({
			metadata: {
				sourceType: "journal-article",
				author: "Ada Lovelace",
				citation: suggestion.metadata.citation,
				journalName: "Journal of Policy",
			},
		});
	});
});

describe("metadataReviewFields", () => {
	test("lists the fields the suggestion changes, accepting those that are empty", () => {
		expect(
			metadataReviewFields(
				{
					title: "refunds.pdf",
					metadata: {
						sourceType: "journal-article",
						author: "Kept Author",
						language: "en",
					},
				},
				suggestion,
			),
		).toEqual([
			{
				field: "title",
				current: "refunds.pdf",
				suggested: "Refund policy 2026",
				accept: false,
			},
			{
				field: "author",
				current: "Kept Author",
				suggested: "Ada Lovelace",
				accept: false,
			},
			{
				field: "citation",
				current: "",
				suggested: suggestion.metadata.citation,
				accept: true,
			},
			{
				field: "journalName",
				current: "",
				suggested: "Journal of Policy",
				accept: true,
			},
			{
				field: "description",
				current: "",
				suggested: "How refunds are paid.",
				accept: true,
			},
		]);
	});
});
