import { describe, expect, mock, test } from "bun:test";
import type { AssetId, UserId } from "@orcai/core";

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
	owner: {
		id: "owner-1" as UserId,
	},
	...overrides,
});

const noop = () => undefined;
const viewer = {
	id: "viewer-1",
	activeOrganizationId: "organization-1",
};
const handlers = {
	onAccess: noop,
	onHandOver: noop,
	onAddToLibrary: noop,
	onPrepareAgain: noop,
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
		expect(actionKeys(assetActions(asset(), handlers, viewer))).toEqual([]);
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
					viewer,
				),
			),
		).toEqual([
			"edit",
			"access",
			"add-to-library",
			"prepareAgain",
			"delete!",
		]);
	});

	test("an asset in processing cannot be prepared again", () => {
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
					viewer,
				),
			),
		).toEqual([
			"edit",
		]);
	});

	test("only its owner hands over a Library asset, never a chat upload", () => {
		const owned = {
			owner: {
				id: "viewer-1" as UserId,
			},
		};
		expect(actionKeys(assetActions(asset(owned), handlers, viewer))).toEqual([
			"hand-over",
		]);
		expect(
			actionKeys(
				assetActions(
					asset({
						...owned,
						origin: "chat",
					}),
					handlers,
					viewer,
				),
			),
		).toEqual([]);
	});

	test("an asset's page offers Hand over only from its home organisation", () => {
		const owned = {
			owner: {
				id: "viewer-1" as UserId,
			},
		};
		expect(
			actionKeys(
				assetActions(
					asset({
						...owned,
						organizationId: "organization-1",
					}),
					handlers,
					viewer,
				),
			),
		).toEqual([
			"hand-over",
		]);
		expect(
			actionKeys(
				assetActions(
					asset({
						...owned,
						organizationId: "organization-2",
					}),
					handlers,
					viewer,
				),
			),
		).toEqual([]);
	});
});
