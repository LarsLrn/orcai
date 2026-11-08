import { describe, expect, mock, test } from "bun:test";
import type { AssetId, BotId, OrganizationId } from "@orcai/core";
import type { HomeOrganization, ResourceRef } from "@orcai/schema";
import type { CatalogueAdder } from "@/components/catalogue/catalogue-adder";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

mock.module("@/lib/orpc/orpc", () => scriptedOrpc());

const { assetStateActions, resourceActions } = await import(
	"./resource-actions"
);

const noop = () => undefined;

const keysOf = (actions: Record<string, HeaderAction | false>) =>
	Object.values(actions).flatMap((action) =>
		action
			? [
					action.destructive ? `${action.key}!` : action.key,
				]
			: [],
	);

const bot: ResourceRef = {
	type: "bot",
	id: "bot-1" as BotId,
};
const asset: ResourceRef = {
	type: "asset",
	id: "asset-1" as AssetId,
};
const elsewhere: HomeOrganization = {
	id: "organization-2" as OrganizationId,
	name: "Writing Centre",
	logo: null,
};
const adder: CatalogueAdder = {
	organisation: "Methods Lab",
};

const actionKeys = (
	ref: ResourceRef,
	capabilities: Record<string, boolean>,
	{
		homeOrganization = null,
		adder,
	}: {
		homeOrganization?: HomeOrganization | null;
		adder?: CatalogueAdder;
	} = {},
) =>
	keysOf(
		resourceActions(
			{
				ref,
				kind: ref.type === "block" ? "behaviour" : ref.type,
				capabilities,
				homeOrganization,
				editLink: {
					to: "/app",
				},
			},
			{
				onAccess: noop,
				onHandOver: noop,
				onDelete: noop,
				onRemove: noop,
			},
			adder,
		),
	);

describe("resourceActions", () => {
	test("each role sees the actions its capabilities allow, Delete last and destructive", () => {
		for (const ref of [
			bot,
			asset,
		]) {
			expect(
				actionKeys(ref, {
					read: true,
					use: true,
				}),
			).toEqual([]);
			expect(
				actionKeys(ref, {
					read: true,
					edit: true,
				}),
			).toEqual([
				"edit",
			]);
			expect(
				actionKeys(ref, {
					edit: true,
					manage_access: true,
					delete: true,
				}),
			).toEqual([
				"edit",
				"access",
				"delete!",
			]);
		}
	});

	test("Hand over is offered exactly where the server grants it", () => {
		const manager = {
			edit: true,
			manage_access: true,
			delete: true,
		};
		expect(
			actionKeys(bot, {
				...manager,
				hand_over: true,
			}),
		).toEqual([
			"edit",
			"access",
			"hand-over",
			"delete!",
		]);
		expect(
			actionKeys(asset, {
				hand_over: true,
			}),
		).toEqual([
			"hand-over",
		]);
		expect(actionKeys(bot, manager)).not.toContain("hand-over");
	});

	test("an item added from the catalogue is shared and removed by adders, never edited, deleted or handed over here", () => {
		const owner = {
			edit: true,
			manage_access: true,
			delete: true,
			hand_over: true,
		};
		expect(
			actionKeys(bot, owner, {
				homeOrganization: elsewhere,
			}),
		).toEqual([]);
		expect(
			actionKeys(bot, owner, {
				homeOrganization: elsewhere,
				adder,
			}),
		).toEqual([
			"access",
			"remove!",
		]);
		expect(
			actionKeys(bot, owner, {
				adder,
			}),
		).toEqual([
			"edit",
			"access",
			"hand-over",
			"delete!",
		]);
	});
});

describe("assetStateActions", () => {
	const stateKeys = (
		overrides: Partial<Parameters<typeof assetStateActions>[0]> = {},
	) =>
		keysOf(
			assetStateActions(
				{
					keptIn: "library",
					processingStatus: "completed",
					processingFailure: null,
					fileType: "pdf",
					capabilities: {
						edit: true,
					},
					...overrides,
				},
				{
					onAddToLibrary: noop,
					onPrepareAgain: noop,
				},
			),
		);

	test("an editable chat upload offers adding it to the Library", () => {
		expect(
			stateKeys({
				keptIn: "chat",
			}),
		).toEqual([
			"add-to-library",
			"prepareAgain",
		]);
		expect(
			stateKeys({
				keptIn: "chat",
				capabilities: {},
			}),
		).toEqual([]);
	});

	test("an asset in processing cannot be prepared again", () => {
		expect(
			stateKeys({
				processingStatus: "active",
			}),
		).toEqual([]);
	});

	test("a failed asset offers Prepare again only where it can help", () => {
		const prepareAgainFor = (
			failure: "unsupported" | "empty" | "timeout",
			fileType: "png" | "docx",
		) =>
			stateKeys({
				processingStatus: "failed",
				processingFailure: failure,
				fileType,
			}).includes("prepareAgain");

		expect(prepareAgainFor("timeout", "docx")).toBe(true);
		expect(prepareAgainFor("unsupported", "png")).toBe(true);
		expect(prepareAgainFor("unsupported", "docx")).toBe(false);
		expect(prepareAgainFor("empty", "png")).toBe(false);
	});
});
