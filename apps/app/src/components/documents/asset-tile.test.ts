import { describe, expect, mock, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import { m } from "@/paraglide/messages";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { assetTileActions, assetTileState } = await import("./asset-tile");

const asset = (
	overrides: Partial<Parameters<typeof assetTileState>[0]> = {},
): Parameters<typeof assetTileState>[0] => ({
	id: "asset-1" as AssetId,
	title: "Methods handbook",
	metadata: {},
	fileType: "pdf",
	origin: "library",
	processingStatus: "completed",
	processingFailure: null,
	metadataStatus: null,
	...overrides,
});

const noop = () => undefined;
const handlers = {
	onAccess: noop,
	onAddToLibrary: noop,
	onReprocess: noop,
	onDelete: noop,
};

const actionKeys = (actions: ReturnType<typeof assetTileActions>) =>
	actions.flatMap((action) =>
		action
			? [
					action.destructive ? `${action.key}!` : action.key,
				]
			: [],
	);

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
				label: m.processing_status_pending_label(),
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
				label: m.processing_status_active_label(),
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
					label: m.processing_status_failed_label(),
					variant: "danger",
				},
			],
			description: m.pipeline_failure_empty(),
			failed: true,
		});
	});

	test("a repository document shows its document state, even when ready", () => {
		expect(
			assetTileState(asset(), {
				state: "ready",
				failure: null,
			}).badges,
		).toMatchObject([
			{
				label: m.document_state_ready_label(),
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
});

describe("assetTileActions", () => {
	test("offers nothing without capabilities", () => {
		expect(actionKeys(assetTileActions(asset(), handlers))).toEqual([]);
	});

	test("an editable chat upload offers adding it to the library, Delete last and destructive", () => {
		expect(
			actionKeys(
				assetTileActions(
					asset({
						origin: "chat",
						capabilities: {
							edit: true,
							manage_access: true,
							delete: true,
						},
					}),
					handlers,
				),
			),
		).toEqual([
			"edit",
			"access",
			"add-to-library",
			"reprocess",
			"delete!",
		]);
	});

	test("an asset in processing cannot be reprocessed", () => {
		expect(
			actionKeys(
				assetTileActions(
					asset({
						processingStatus: "active",
						capabilities: {
							edit: true,
						},
					}),
					handlers,
				),
			),
		).toEqual([
			"edit",
		]);
	});
});
