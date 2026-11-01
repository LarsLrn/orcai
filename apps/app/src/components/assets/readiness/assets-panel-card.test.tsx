import { afterEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import type { RepositoryReadiness } from "@orcai/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { AssetsPanelCard } from "./assets-panel-card";
import { assetsPanelView } from "./assets-panel-view";

afterEach(() => {
	cleanup();
});

const repository = (
	name: string,
	totals: Omit<RepositoryReadiness["totals"], "total">,
): RepositoryReadiness => ({
	blockId: crypto.randomUUID() as BlockId,
	name,
	capabilities: {
		read: true,
	},
	totals: {
		...totals,
		total: totals.ready + totals.preparing + totals.failed,
	},
	assets: [],
});

describe("assetsPanelView", () => {
	test("is gone when every asset is ready or there are none", () => {
		expect(assetsPanelView([])).toBeUndefined();
		expect(
			assetsPanelView([
				repository("Handbook", {
					ready: 3,
					preparing: 0,
					failed: 0,
				}),
			]),
		).toBeUndefined();
	});

	test("prepares while any asset is unsettled, summing every repository", () => {
		expect(
			assetsPanelView([
				repository("Handbook", {
					ready: 38,
					preparing: 80,
					failed: 2,
				}),
				repository("Slides", {
					ready: 4,
					preparing: 0,
					failed: 0,
				}),
			]),
		).toEqual({
			status: "preparing",
			ready: 42,
			total: 124,
			failed: 2,
		});
	});

	test("reports failures once nothing is left to prepare", () => {
		expect(
			assetsPanelView([
				repository("Handbook", {
					ready: 1,
					preparing: 0,
					failed: 2,
				}),
			]),
		).toMatchObject({
			status: "failed",
			failed: 2,
		});
	});
});

describe("AssetsPanelCard", () => {
	test("is collapsed by default with the preparing title and tally", () => {
		render(
			<AssetsPanelCard
				repositories={[
					repository("Handbook", {
						ready: 38,
						preparing: 80,
						failed: 2,
					}),
				]}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: new RegExp(`${m.assets_panel_preparing_title()}.*38/120`),
			}),
		).toBeTruthy();
		expect(screen.queryByText("Handbook")).toBeNull();
	});

	test("with only failures left, says how many could not be prepared", () => {
		render(
			<AssetsPanelCard
				repositories={[
					repository("Handbook", {
						ready: 1,
						preparing: 0,
						failed: 2,
					}),
				]}
			/>,
		);

		expect(
			screen.getByText(
				m.assets_panel_failed_title({
					count: 2,
				}),
			),
		).toBeTruthy();
	});
});
