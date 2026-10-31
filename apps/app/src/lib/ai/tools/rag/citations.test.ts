import { describe, expect, test } from "bun:test";
import { messageCitations, turnCitations } from "./citations";
import type { Passage } from "./types";

const passage = (fields: Partial<Passage>): Passage => ({
	ref: "k000001",
	id: "c1",
	assetId: "asset-a",
	title: "Refund policy",
	blockName: "Handbook",
	text: "Refunds are paid within 14 days.",
	...fields,
});

const searchPart = (results: Passage[]) => ({
	type: "tool-searchRepositories",
	toolCallId: "s1",
	state: "output-available",
	input: {
		query: "refunds",
	},
	output: {
		results,
	},
});

describe("turnCitations", () => {
	const earlierTurn = [
		{
			id: "q1",
			parts: [
				{
					type: "text",
					text: "What about refunds?",
				},
			],
		},
		{
			id: "r1",
			parts: [
				searchPart([
					passage({
						ref: "k000001",
						pageStart: 4,
						pageEnd: 4,
					}),
				]),
				{
					type: "text",
					text: "Within 14 days.",
				},
			],
		},
	];

	test("covers the refs the reply cites from this turn's steps and from earlier turns", () => {
		expect(
			turnCitations({
				prompt: earlierTurn,
				replyId: "r2",
				steps: [
					{
						text: "",
						toolResults: [
							{
								toolName: "getPassages",
								output: {
									passages: [
										passage({
											ref: "k000002",
											assetId: "asset-b",
											title: "Travel policy",
											pageStart: 2,
											pageEnd: 3,
										}),
									],
								},
							},
						],
					},
					{
						text: 'Paid <cite chunk="k000001">within 14 days</cite>, travel <cite chunk="k000002">by train</cite>.',
						toolResults: [],
					},
				],
			}),
		).toEqual({
			k000001: {
				assetId: "asset-a",
				title: "Refund policy",
				page: 4,
			},
			k000002: {
				assetId: "asset-b",
				title: "Travel policy",
			},
		});
	});

	test("leaves out refs no passage carries and refs the reply does not cite", () => {
		expect(
			turnCitations({
				prompt: earlierTurn,
				replyId: "r2",
				steps: [
					{
						text: 'Paid <cite chunk="k999999">soon</cite>.',
						toolResults: [],
					},
				],
			}),
		).toBeUndefined();
	});

	test("reads the cites of a continued reply's earlier text", () => {
		const continued = [
			{
				id: "r2",
				parts: [
					searchPart([
						passage({}),
					]),
					{
						type: "text",
						text: 'Paid <cite chunk="k000001">within 14 days</cite>.',
					},
				],
			},
		];

		expect(
			turnCitations({
				prompt: continued,
				replyId: "r2",
				steps: [],
			}),
		).toEqual({
			k000001: {
				assetId: "asset-a",
				title: "Refund policy",
			},
		});
	});
});

describe("messageCitations", () => {
	test("reads a streaming reply's own calls until the stored citations arrive", () => {
		const parts = [
			searchPart([
				passage({}),
			]),
		];

		expect(
			messageCitations({
				parts,
			}),
		).toEqual({
			k000001: {
				assetId: "asset-a",
				title: "Refund policy",
			},
		});
		expect(
			messageCitations({
				parts: [],
				metadata: {
					citations: {
						k000003: {
							assetId: "asset-c",
							title: "Leave policy",
							page: 9,
						},
					},
				},
			}),
		).toEqual({
			k000003: {
				assetId: "asset-c",
				title: "Leave policy",
				page: 9,
			},
		});
	});
});
