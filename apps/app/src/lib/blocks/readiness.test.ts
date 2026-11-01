import { describe, expect, test } from "bun:test";
import {
	type AssetState,
	PIPELINE_STATUSES,
	type PipelineStatus,
} from "@orcai/schema";
import { assetState, readinessTotals } from "./readiness";

const row = (
	processingStatus: PipelineStatus,
	indexStatus: PipelineStatus,
) => ({
	processingStatus,
	processingFailure: null,
	indexStatus,
	indexFailure: null,
});

describe("assetState", () => {
	test.each([
		...PIPELINE_STATUSES,
	])(
		"processing decides while it is not completed (index %s)",
		(indexStatus) => {
			expect(assetState(row("pending", indexStatus)).state).toBe("queued");
			expect(assetState(row("active", indexStatus)).state).toBe("processing");
			expect(assetState(row("failed", indexStatus)).state).toBe("failed");
		},
	);

	test("a processed asset is indexing until its link is indexed", () => {
		expect(
			PIPELINE_STATUSES.map(
				(indexStatus) => assetState(row("completed", indexStatus)).state,
			),
		).toEqual([
			"indexing",
			"indexing",
			"ready",
			"failed",
		]);
	});

	test("a failure names its stage and kind", () => {
		expect(
			assetState({
				...row("failed", "failed"),
				processingFailure: "empty",
				indexFailure: "timeout",
			}).failure,
		).toEqual({
			stage: "processing",
			kind: "empty",
		});
		expect(
			assetState({
				...row("completed", "failed"),
				indexFailure: "timeout",
			}).failure,
		).toEqual({
			stage: "indexing",
			kind: "timeout",
		});
	});

	test("a failure without a recorded kind counts as other", () => {
		expect(assetState(row("completed", "failed")).failure).toEqual({
			stage: "indexing",
			kind: "other",
		});
	});

	test("only failed assets carry a failure", () => {
		expect(
			assetState({
				...row("active", "pending"),
				processingFailure: "extraction",
			}).failure,
		).toBeNull();
	});
});

describe("readinessTotals", () => {
	test("counts ready, preparing and failed assets", () => {
		expect(
			readinessTotals(
				(
					[
						"queued",
						"processing",
						"indexing",
						"ready",
						"ready",
						"failed",
					] satisfies AssetState[]
				).map((state) => ({
					state,
				})),
			),
		).toEqual({
			total: 6,
			ready: 2,
			preparing: 3,
			failed: 1,
		});
	});

	test("an empty repository has nothing to prepare", () => {
		expect(readinessTotals([])).toEqual({
			total: 0,
			ready: 0,
			preparing: 0,
			failed: 0,
		});
	});
});
