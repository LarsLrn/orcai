import { afterEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import type { RepositoryReadiness } from "@orcai/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { PublishSummary } from "./publish-summary";

afterEach(() => {
	cleanup();
});

const repository = (
	name: string,
	totals: RepositoryReadiness["totals"],
): RepositoryReadiness => ({
	blockId: crypto.randomUUID() as BlockId,
	name,
	capabilities: {},
	totals,
	documents: [],
});

describe("PublishSummary", () => {
	test("notes each repository whose documents are not all ready", () => {
		render(
			<PublishSummary
				grants={[]}
				grantsAvailable
				repositories={[
					repository("Handbook", {
						total: 120,
						ready: 38,
						preparing: 80,
						failed: 2,
					}),
					repository("Slides", {
						total: 4,
						ready: 4,
						preparing: 0,
						failed: 0,
					}),
				]}
			/>,
		);

		expect(
			screen.getByText(
				`${m.authoring_publish_summary_documents_ready({
					name: "Handbook",
					ready: 38,
					total: 120,
				})} ${m.authoring_publish_summary_documents_failed({
					count: 2,
				})}`,
			),
		).toBeTruthy();
		expect(screen.queryByText(/Slides/)).toBeNull();
	});

	test("adds no note when every document is ready", () => {
		render(<PublishSummary grants={[]} grantsAvailable repositories={[]} />);

		expect(
			screen.queryByText(m.authoring_publish_summary_documents_fact_label()),
		).toBeNull();
	});
});
