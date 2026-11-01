import { describe, expect, test } from "bun:test";
import { joinOverlapping, neighbouringRuns } from "./passages";
import { point } from "./test-points";

describe("joinOverlapping", () => {
	test("drops the start the next passage repeats", () => {
		expect(
			joinOverlapping(
				"Refunds are paid within 14 days of the request being approved.",
				"of the request being approved. Late refunds earn interest.",
			),
		).toBe(
			"Refunds are paid within 14 days of the request being approved. Late refunds earn interest.",
		);
	});

	test("keeps both texts apart when they share nothing", () => {
		expect(joinOverlapping("First part.", "Second part.")).toBe(
			"First part.\n\nSecond part.",
		);
	});

	test("does not treat a short shared edge as overlap", () => {
		expect(joinOverlapping("It ends with the", "the next one.")).toBe(
			"It ends with the\n\nthe next one.",
		);
	});
});

describe("neighbouringRuns", () => {
	const ids = (runs: ReturnType<typeof neighbouringRuns>) =>
		runs.map((run) => run.map((point) => point.id));

	test("joins neighbouring passages of one asset in index order", () => {
		expect(
			ids(
				neighbouringRuns([
					point({
						id: "c3",
						index: 3,
					}),
					point({
						id: "c2",
						index: 2,
					}),
					point({
						id: "c4",
						index: 4,
					}),
				]),
			),
		).toEqual([
			[
				"c2",
				"c3",
				"c4",
			],
		]);
	});

	test("splits at gaps and between assets, in the order first seen", () => {
		expect(
			ids(
				neighbouringRuns([
					point({
						id: "b1",
						index: 1,
						assetId: "asset-b",
					}),
					point({
						id: "a7",
						index: 7,
					}),
					point({
						id: "a2",
						index: 2,
					}),
					point({
						id: "b2",
						index: 2,
						assetId: "asset-b",
					}),
				]),
			),
		).toEqual([
			[
				"b1",
				"b2",
			],
			[
				"a7",
			],
			[
				"a2",
			],
		]);
	});

	test("reads a passage found twice once", () => {
		expect(
			ids(
				neighbouringRuns([
					point({
						id: "c1",
						index: 1,
					}),
					point({
						id: "c1",
						index: 1,
					}),
				]),
			),
		).toEqual([
			[
				"c1",
			],
		]);
	});
});
