import { describe, expect, test } from "bun:test";
import {
	acceptedReviewFields,
	applyMetadataSuggestion,
	fitMetadataToSourceType,
	metadataReviewFields,
	metadataSchema,
} from "../src";

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
			filled: [
				"title",
				"citation",
				"sourceType",
				"journalName",
				"description",
				"language",
			],
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

	test("a source type change keeps its type's fields rejected while the type is", () => {
		const fields = metadataReviewFields(
			{
				title: "Refunds",
				metadata: {
					sourceType: "book",
				},
			},
			suggestion,
		);

		expect(
			fields.map(({ field, accept, requiresType }) => ({
				field,
				accept,
				requiresType,
			})),
		).toEqual([
			{
				field: "title",
				accept: false,
				requiresType: undefined,
			},
			{
				field: "sourceType",
				accept: false,
				requiresType: undefined,
			},
			{
				field: "author",
				accept: false,
				requiresType: true,
			},
			{
				field: "citation",
				accept: false,
				requiresType: true,
			},
			{
				field: "journalName",
				accept: false,
				requiresType: true,
			},
			{
				field: "description",
				accept: true,
				requiresType: undefined,
			},
			{
				field: "language",
				accept: true,
				requiresType: undefined,
			},
		]);
		expect(
			acceptedReviewFields(
				fields,
				new Set([
					"journalName",
					"description",
				]),
			).map(({ field }) => field),
		).toEqual([
			"description",
		]);
		expect(
			acceptedReviewFields(
				fields,
				new Set([
					"sourceType",
					"journalName",
				]),
			).map(({ field }) => field),
		).toEqual([
			"sourceType",
			"journalName",
		]);
	});

	test("lists only fields the resulting source type has", () => {
		expect(
			metadataReviewFields(
				{
					title: "Notes",
					metadata: {
						sourceType: "book",
					},
				},
				{
					metadata: {
						journalName: "Journal of Policy",
						chapterTitle: "Notes on refunds",
					},
				},
			).map(({ field }) => field),
		).toEqual([
			"chapterTitle",
		]);
	});

	test("an untyped asset accepts the suggested type with its fields", () => {
		expect(
			metadataReviewFields(
				{
					title: "Refunds",
					metadata: {},
				},
				suggestion,
			).map(({ field, accept, requiresType }) => ({
				field,
				accept,
				requiresType,
			})),
		).toEqual([
			{
				field: "title",
				accept: false,
				requiresType: undefined,
			},
			{
				field: "sourceType",
				accept: true,
				requiresType: undefined,
			},
			{
				field: "author",
				accept: true,
				requiresType: true,
			},
			{
				field: "citation",
				accept: true,
				requiresType: true,
			},
			{
				field: "journalName",
				accept: true,
				requiresType: true,
			},
			{
				field: "description",
				accept: true,
				requiresType: undefined,
			},
			{
				field: "language",
				accept: true,
				requiresType: undefined,
			},
		]);
	});
});

describe("fitMetadataToSourceType", () => {
	test("drops the fields its source type does not have, keeping the shared ones", () => {
		expect(
			fitMetadataToSourceType({
				sourceType: "legal-text",
				journalName: "Journal of Policy",
				doi: "10.1/x",
				citation: "BGB § 1",
				description: "About refunds.",
				externalUrl: "https://example.org",
			}),
		).toEqual({
			sourceType: "legal-text",
			citation: "BGB § 1",
			description: "About refunds.",
			externalUrl: "https://example.org",
		});
	});

	test("untyped metadata keeps every field", () => {
		const metadata = {
			journalName: "Journal of Policy",
			legalReference: "BGB § 1",
		};

		expect(fitMetadataToSourceType(metadata)).toEqual(metadata);
	});
});

describe("metadataSchema", () => {
	test("takes a BCP 47 language tag or an empty one", () => {
		expect(
			metadataSchema.safeParse({
				language: "de-CH",
			}).success,
		).toBe(true);
		expect(
			metadataSchema.safeParse({
				language: "",
			}).success,
		).toBe(true);
		expect(
			metadataSchema.safeParse({
				language: "en-",
			}).success,
		).toBe(false);
	});
});
