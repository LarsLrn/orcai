import { describe, expect, test } from "bun:test";
import type { Passage } from "@/lib/ai/tools/rag/types";
import { chatSources, citableText } from "./chat-sources";
import { sourceRef } from "./source-ref";

const passage = (id: string, page?: number, ref = sourceRef("passage", id)) =>
	({
		ref,
		id,
		assetId: `asset-${id}`,
		title: `Title ${id}`,
		blockName: "Handbook",
		...(page !== undefined && {
			pageStart: page,
			pageEnd: page,
		}),
		text: `Text ${id}`,
	}) satisfies Passage;

const searchPart = (...results: Passage[]) => ({
	type: "tool-searchRepositories",
	toolCallId: crypto.randomUUID(),
	state: "output-available",
	input: {
		query: "q",
	},
	output: {
		results,
	},
});

const message = (...parts: object[]) => ({
	parts: parts as {
		type: string;
	}[],
});

const cite = (ref: string) => `<cite ref=${ref}>text</cite>`;

describe("chatSources", () => {
	test("resolves refs from the stored history and from calls of this turn", () => {
		const earlier = passage("p1", 4);
		const now = passage("p2");
		const sources = chatSources([
			message(searchPart(earlier)),
		]);
		sources.record("getPassages", {
			passages: [
				now,
			],
		});

		expect(
			sources.citations(
				`${cite(earlier.ref)} ${cite(now.ref)} ${cite("k000000")}`,
			),
		).toEqual({
			[earlier.ref]: {
				kind: "asset",
				assetId: "asset-p1",
				title: "Title p1",
				page: 4,
			},
			[now.ref]: {
				kind: "asset",
				assetId: "asset-p2",
				title: "Title p2",
			},
		});
	});

	test("reads cites quoted or not, and only those of the text", () => {
		const first = passage("p1");
		const second = passage("p2");
		const sources = chatSources([
			message(searchPart(first, second)),
		]);

		expect(
			Object.keys(sources.citations(`<cite ref="${first.ref}">a</cite>`)),
		).toEqual([
			first.ref,
		]);
	});

	test("a passage read on one page names the page, whichever came first", () => {
		const anywhere = passage("p1");
		const onPage = passage("p1", 7);
		const sources = chatSources([
			message(searchPart(anywhere)),
			message(searchPart(onPage)),
		]);

		expect(sources.citations(cite(anywhere.ref))[anywhere.ref]).toMatchObject({
			page: 7,
		});
	});

	test("a ref two identities claim names nothing, in history, in new calls and across both", () => {
		const shared = "k111111";
		const inHistory = chatSources([
			message(searchPart(passage("p1", 1, shared))),
			message(searchPart(passage("p2", 2, shared))),
		]);
		const inCalls = chatSources([]);
		inCalls.record("searchRepositories", {
			results: [
				passage("p1", 1, shared),
			],
		});
		inCalls.record("getPassages", {
			passages: [
				passage("p2", 2, shared),
			],
		});
		const across = chatSources([
			message(searchPart(passage("p1", 1, shared))),
		]);
		across.record("searchRepositories", {
			results: [
				passage("p2", 2, shared),
				passage("p3", 3, shared),
			],
		});

		for (const sources of [
			inHistory,
			inCalls,
			across,
		]) {
			expect(sources.citations(cite(shared))).toEqual({});
			expect(sources.identityOf(shared)).toBeUndefined();
		}
		expect(across.collisions()).toEqual([
			{
				ref: shared,
				identities: [
					"p1",
					"p2",
					"p3",
				],
			},
		]);
	});

	test("ignores calls without sources, unfinished calls and outputs of an older shape", () => {
		const sources = chatSources([
			message(
				{
					...searchPart(passage("p1")),
					state: "input-available",
				},
				{
					type: "tool-searchRepositories",
					state: "output-available",
					output: {
						documents: [],
					},
				},
				{
					type: "tool-listRepositoryAssets",
					state: "output-available",
					output: {
						assets: [],
					},
				},
			),
		]);
		sources.record("unknownTool", {
			results: [
				passage("p2"),
			],
		});

		expect(
			sources.citations(
				cite(sourceRef("passage", "p1")) + cite(sourceRef("passage", "p2")),
			),
		).toEqual({});
	});
});

describe("citableText", () => {
	test("reads text parts and every string of display calls, nested", () => {
		const text = citableText([
			{
				type: "text",
				text: "one",
			},
			{
				type: "tool-showMatrix",
				input: {
					rows: [
						{
							cells: [
								[
									{
										note: "two",
									},
								],
							],
						},
					],
				},
			},
			{
				type: "tool-searchRepositories",
				input: {
					query: "three",
				},
			},
		] as unknown as {
			type: string;
		}[]);

		expect(text).toContain("one");
		expect(text).toContain("two");
		expect(text).not.toContain("three");
	});
});
