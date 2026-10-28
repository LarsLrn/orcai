import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPoint } from "@orcai/schema";
import { selectDiversePoints } from "../src/utils/result-set";

/** Points ranked as listed, each named `<asset><n>`, e.g. "a1". */
const ranked = (...ids: string[]): AssetPoint[] =>
	ids.map((id, index) => ({
		id,
		version: 0,
		score: 1 - index / 100,
		payload: {
			source: "text",
			asset_id: id.slice(0, 1) as AssetId,
			block_id: "block" as BlockId,
			text: id,
			title: id.slice(0, 1),
			depth: 0,
			tokens: 1,
			chunk_index: index,
			chunkCount: ids.length,
			createdAt: "2026-01-01T00:00:00.000Z",
		},
	}));

const select = (
	points: AssetPoint[],
	options: {
		limit: number;
		maxPerAsset: number;
	},
) => selectDiversePoints(points, options).map((point) => point.id);

describe("selectDiversePoints", () => {
	test("fills the limit from a single document", () => {
		expect(
			select(ranked("a1", "a2", "a3", "a4", "a5", "a6"), {
				limit: 5,
				maxPerAsset: 2,
			}),
		).toEqual([
			"a1",
			"a2",
			"a3",
			"a4",
			"a5",
		]);
	});

	test("keeps the cap when enough documents match", () => {
		expect(
			select(ranked("a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "d1"), {
				limit: 6,
				maxPerAsset: 2,
			}),
		).toEqual([
			"a1",
			"a2",
			"b1",
			"b2",
			"c1",
			"c2",
		]);
	});

	test("fills the slots the cap leaves with the next-best chunks, in rank order", () => {
		expect(
			select(ranked("a1", "a2", "a3", "b1", "a4", "a5", "b2", "b3", "c1"), {
				limit: 7,
				maxPerAsset: 2,
			}),
		).toEqual([
			"a1",
			"a2",
			"a3",
			"b1",
			"a4",
			"b2",
			"c1",
		]);
	});

	test("returns only the given candidates when they are fewer than the limit", () => {
		expect(
			select(ranked("a1", "a2", "a3", "b1"), {
				limit: 10,
				maxPerAsset: 1,
			}),
		).toEqual([
			"a1",
			"a2",
			"a3",
			"b1",
		]);
	});

	test("an explicit cap at the limit ranks without diversity", () => {
		expect(
			select(ranked("a1", "a2", "a3", "b1", "c1"), {
				limit: 3,
				maxPerAsset: 3,
			}),
		).toEqual([
			"a1",
			"a2",
			"a3",
		]);
	});
});
