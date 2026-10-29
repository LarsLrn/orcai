import { describe, expect, test } from "bun:test";
import {
	ORGANIZATION_DESCRIPTION_MAX_LENGTH,
	organizationDescriptionSchema,
} from "../src/organization/description";

const paragraph = (...content: object[]) => ({
	type: "paragraph",
	content,
});

const link = (href: string) => ({
	type: "text",
	text: "Contact",
	marks: [
		{
			type: "link",
			attrs: {
				href,
				target: "_blank",
				rel: "noopener noreferrer nofollow",
				class: null,
			},
		},
	],
});

const doc = (...content: object[]) => ({
	type: "doc",
	content,
});

describe("organizationDescriptionSchema", () => {
	test("accepts headings, lists, quotes and marked text", () => {
		const description = doc(
			{
				type: "heading",
				attrs: {
					level: 3,
				},
				content: [
					{
						type: "text",
						text: "What we share",
					},
				],
			},
			{
				type: "bulletList",
				content: [
					{
						type: "listItem",
						content: [
							paragraph({
								type: "text",
								text: "Reading lists",
								marks: [
									{
										type: "bold",
									},
								],
							}),
						],
					},
				],
			},
			{
				type: "orderedList",
				attrs: {
					start: 1,
					type: null,
				},
				content: [
					{
						type: "listItem",
						content: [
							paragraph(),
						],
					},
				],
			},
			{
				type: "blockquote",
				content: [
					paragraph(),
				],
			},
			paragraph(
				link("https://uni.example/methods"),
				{
					type: "hardBreak",
				},
				link("mailto:methods@uni.example"),
				link("tel:+49301234"),
			),
		);

		expect(organizationDescriptionSchema.parse(description)).toEqual(
			description as never,
		);
	});

	test.each([
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"//evil.example",
		"/app/organization",
		"vbscript:msgbox",
	])("refuses a link to %s", (href) => {
		expect(
			organizationDescriptionSchema.safeParse(doc(paragraph(link(href))))
				.success,
		).toBe(false);
	});

	test.each([
		[
			"an image",
			{
				type: "image",
				attrs: {
					src: "https://uni.example/x.png",
				},
			},
		],
		[
			"a table",
			{
				type: "table",
				content: [],
			},
		],
		[
			"an h1",
			{
				type: "heading",
				attrs: {
					level: 1,
				},
			},
		],
		[
			"a paragraph with unknown attributes",
			{
				type: "paragraph",
				attrs: {
					style: "position:fixed",
				},
			},
		],
		[
			"text with an unknown mark",
			paragraph({
				type: "text",
				text: "x",
				marks: [
					{
						type: "textStyle",
						attrs: {
							color: "red",
						},
					},
				],
			}),
		],
	])("refuses %s", (_, node) => {
		expect(organizationDescriptionSchema.safeParse(doc(node)).success).toBe(
			false,
		);
	});

	test("refuses a document that is not one", () => {
		for (const value of [
			null,
			"text",
			[],
			{
				type: "paragraph",
			},
		])
			expect(organizationDescriptionSchema.safeParse(value).success).toBe(
				false,
			);
	});

	test("refuses a description over the size bound before reading its structure", () => {
		const text = "x".repeat(ORGANIZATION_DESCRIPTION_MAX_LENGTH);
		const result = organizationDescriptionSchema.safeParse(
			doc(
				paragraph({
					type: "text",
					text,
				}),
			),
		);

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.code)).toEqual([
			"too_big",
		]);
	});
});
