import { describe, expect, mock, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import { m } from "@/paraglide/messages";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { assetTileState } = await import("./asset-tile");

const asset = (
	overrides: Partial<Parameters<typeof assetTileState>[0]> = {},
): Parameters<typeof assetTileState>[0] => ({
	id: "asset-1" as AssetId,
	title: "Methods handbook",
	metadata: {},
	fileType: "pdf",
	keptIn: "library",
	processingStatus: "completed",
	processingFailure: null,
	metadataStatus: null,
	...overrides,
});

describe("assetTileState", () => {
	test("a finished asset shows no state, and its chapter as description", () => {
		expect(
			assetTileState(
				asset({
					metadata: {
						chapterTitle: "Sampling",
					},
				}),
			),
		).toEqual({
			badges: [],
			description: m.assets_tile_chapter_description({
				name: "Sampling",
			}),
			failed: false,
		});
	});

	test("a queued or running asset shows its processing state", () => {
		expect(
			assetTileState(
				asset({
					processingStatus: "pending",
				}),
			).badges,
		).toMatchObject([
			{
				label: m.asset_state_queued_label(),
				variant: "info",
			},
		]);
		expect(
			assetTileState(
				asset({
					processingStatus: "active",
				}),
			).badges,
		).toMatchObject([
			{
				label: m.asset_state_processing_label(),
				variant: "processing",
			},
		]);
	});

	test("generated metadata: a description wins, and generation shows a badge", () => {
		expect(
			assetTileState(
				asset({
					metadataStatus: "active",
					metadata: {
						description: "A handbook on sampling.",
						author: "Ada",
					},
				}),
			),
		).toEqual({
			badges: [
				expect.objectContaining({
					label: m.assets_metadata_generating_badge(),
				}),
			],
			description: "A handbook on sampling.",
			failed: false,
		});
	});

	test("a failed asset says why in place of its description", () => {
		expect(
			assetTileState(
				asset({
					processingStatus: "failed",
					processingFailure: "empty",
					metadata: {
						author: "Ada",
					},
				}),
			),
		).toMatchObject({
			badges: [
				{
					label: m.asset_state_failed_label(),
					variant: "danger",
				},
			],
			description: m.pipeline_failure_empty(),
			failed: true,
		});
	});

	test("a repository asset shows its asset state, even when ready", () => {
		expect(
			assetTileState(asset(), {
				state: "ready",
				failure: null,
			}).badges,
		).toMatchObject([
			{
				label: m.asset_state_ready_label(),
				variant: "success",
			},
		]);
		expect(
			assetTileState(asset(), {
				state: "failed",
				failure: {
					stage: "indexing",
					kind: "timeout",
				},
			}),
		).toMatchObject({
			description: m.pipeline_failure_timeout(),
			failed: true,
		});
	});

	test("indexing waits for the embedding setup until there is one", () => {
		expect(
			assetTileState(
				asset(),
				{
					state: "indexing",
					failure: null,
				},
				false,
			).badges,
		).toMatchObject([
			{
				label: m.asset_state_waiting_for_embeddings_label(),
				variant: "info",
			},
		]);
	});
});
