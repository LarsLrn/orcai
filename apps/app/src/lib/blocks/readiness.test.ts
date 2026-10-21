import { describe, expect, test } from "bun:test";
import {
	type DocumentState,
	PIPELINE_STATUSES,
	type PipelineStatus,
} from "@orcai/schema";
import { documentState, readinessTotals } from "./readiness";

const row = (
	processingStatus: PipelineStatus,
	indexStatus: PipelineStatus,
) => ({
	processingStatus,
	processingFailure: null,
	indexStatus,
	indexFailure: null,
});

describe("documentState", () => {
	test.each([
		...PIPELINE_STATUSES,
	])(
		"processing decides while it is not completed (index %s)",
		(indexStatus) => {
			expect(documentState(row("pending", indexStatus)).state).toBe("queued");
			expect(documentState(row("active", indexStatus)).state).toBe(
				"processing",
			);
			expect(documentState(row("failed", indexStatus)).state).toBe("failed");
		},
	);

	test("a processed document is indexing until its link is indexed", () => {
		expect(
			PIPELINE_STATUSES.map(
				(indexStatus) => documentState(row("completed", indexStatus)).state,
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
			documentState({
				...row("failed", "failed"),
				processingFailure: "empty",
				indexFailure: "timeout",
			}).failure,
		).toEqual({
			stage: "processing",
			kind: "empty",
		});
		expect(
			documentState({
				...row("completed", "failed"),
				indexFailure: "timeout",
			}).failure,
		).toEqual({
			stage: "indexing",
			kind: "timeout",
		});
	});

	test("a failure without a recorded kind counts as other", () => {
		expect(documentState(row("completed", "failed")).failure).toEqual({
			stage: "indexing",
			kind: "other",
		});
	});

	test("only failed documents carry a failure", () => {
		expect(
			documentState({
				...row("active", "pending"),
				processingFailure: "extraction",
			}).failure,
		).toBeNull();
	});
});

describe("readinessTotals", () => {
	test("counts ready, preparing and failed documents", () => {
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
					] satisfies DocumentState[]
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
