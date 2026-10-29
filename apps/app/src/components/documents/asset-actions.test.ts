import { describe, expect, mock, test } from "bun:test";
import type { AssetId } from "@orcai/core";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { assetActions } = await import("./asset-actions");

const asset = (
	overrides: Partial<Parameters<typeof assetActions>[0]> = {},
): Parameters<typeof assetActions>[0] => ({
	id: "asset-1" as AssetId,
	origin: "library",
	processingStatus: "completed",
	...overrides,
});

const noop = () => undefined;
const handlers = {
	onAccess: noop,
	onAddToLibrary: noop,
	onReprocess: noop,
	onDelete: noop,
};

const actionKeys = (actions: ReturnType<typeof assetActions>) =>
	Object.values(actions).flatMap((action) =>
		action
			? [
					action.destructive ? `${action.key}!` : action.key,
				]
			: [],
	);

describe("assetActions", () => {
	test("offers nothing without capabilities", () => {
		expect(actionKeys(assetActions(asset(), handlers))).toEqual([]);
	});

	test("an editable chat upload offers adding it to the library, Delete last and destructive", () => {
		expect(
			actionKeys(
				assetActions(
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
				assetActions(
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
