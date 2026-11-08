import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { parseAssetPoints } from "../src/queries";

const record = (ranking: Record<string, unknown>) => ({
	id: "point",
	payload: {
		source: "text",
		asset_id: crypto.randomUUID(),
		block_id: crypto.randomUUID(),
		text: "passage",
		depth: 0,
		tokens: 1,
		chunk_index: 0,
		chunkCount: 1,
		createdAt: "2026-01-01T00:00:00.000Z",
		index_attempt: 1,
		published: true,
	},
	...ranking,
});

const rankingOf = (ranking: Record<string, unknown>) =>
	Effect.runPromise(
		parseAssetPoints([
			record(ranking),
		]).pipe(
			Effect.map(([point]) => ({
				version: point?.version,
				score: point?.score,
			})),
		),
	);

describe("parseAssetPoints", () => {
	test("keeps a scored point's version and score", async () => {
		expect(
			await rankingOf({
				version: 3,
				score: 0.5,
			}),
		).toEqual({
			version: 3,
			score: 0.5,
		});
	});

	test("ranks a record without a numeric version or score 0", async () => {
		for (const missing of [
			{},
			{
				version: null,
				score: null,
			},
			{
				version: "3",
				score: "0.5",
			},
		]) {
			expect(await rankingOf(missing)).toEqual({
				version: 0,
				score: 0,
			});
		}
	});

	test("fails on a version or score that is not finite", async () => {
		for (const value of [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		]) {
			for (const ranking of [
				{
					version: value,
					score: 0.5,
				},
				{
					version: 1,
					score: value,
				},
			]) {
				const error = await Effect.runPromise(
					Effect.flip(
						parseAssetPoints([
							record(ranking),
						]),
					),
				);
				expect(error).toMatchObject({
					_tag: "QdrantError",
					operation: "parse_query_response",
				});
			}
		}
	});
});
