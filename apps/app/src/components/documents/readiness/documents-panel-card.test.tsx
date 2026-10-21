import { afterEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import type { RepositoryReadiness } from "@orcai/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { DocumentsPanelCard } from "./documents-panel-card";
import { documentsPanelView } from "./documents-panel-view";

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
	documents: [],
});

describe("documentsPanelView", () => {
	test("is gone when every document is ready or there are none", () => {
		expect(documentsPanelView([])).toBeUndefined();
		expect(
			documentsPanelView([
				repository("Handbook", {
					ready: 3,
					preparing: 0,
					failed: 0,
				}),
			]),
		).toBeUndefined();
	});

	test("prepares while any document is unsettled, summing every repository", () => {
		expect(
			documentsPanelView([
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
			documentsPanelView([
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

describe("DocumentsPanelCard", () => {
	test("is collapsed by default with the preparing title and tally", () => {
		render(
			<DocumentsPanelCard
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
				name: new RegExp(`${m.documents_panel_preparing_title()}.*38/120`),
			}),
		).toBeTruthy();
		expect(screen.queryByText("Handbook")).toBeNull();
	});

	test("with only failures left, says how many could not be prepared", () => {
		render(
			<DocumentsPanelCard
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
				m.documents_panel_failed_title({
					count: 2,
				}),
			),
		).toBeTruthy();
	});
});
