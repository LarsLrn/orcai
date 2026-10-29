import { describe, expect, mock, test } from "bun:test";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { repositoryFooter } = await import("./block-tile");

const labels = (totals: {
	total: number;
	ready: number;
	preparing: number;
	failed: number;
}) => {
	const { label, badges } = repositoryFooter(totals);
	return [
		label,
		...badges.map((badge) => `${badge.label} (${badge.variant})`),
	];
};

describe("repositoryFooter", () => {
	test("an empty repository says so", () => {
		expect(
			labels({
				total: 0,
				ready: 0,
				preparing: 0,
				failed: 0,
			}),
		).toEqual([
			"No assets yet",
		]);
	});

	test("counts assets, then those preparing and failed", () => {
		expect(
			labels({
				total: 18,
				ready: 14,
				preparing: 3,
				failed: 1,
			}),
		).toEqual([
			"18 assets",
			"3 preparing (info)",
			"1 failed (danger)",
		]);
		expect(
			labels({
				total: 1,
				ready: 1,
				preparing: 0,
				failed: 0,
			}),
		).toEqual([
			"1 asset",
		]);
	});
});
