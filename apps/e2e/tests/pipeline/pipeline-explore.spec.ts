import type { Page } from "@playwright/test";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import {
	preparedReadiness,
	repositoryWithDocument,
} from "../../fixtures/pipeline/repository";

const SECTIONS = 70;
const NEEDLE = "zanzibarquokka";
/** A term no passage contains. */
const ABSENT = "marmaladequasar";

const marker = (index: number) => `Marker-${String(index).padStart(3, "0")}`;

/** Sections of about 700 characters, so the chunker (1,000 at most) keeps one per passage. */
const document = Array.from(
	{
		length: SECTIONS,
	},
	(_, index) =>
		[
			`## Section ${index + 1}`,
			"",
			`${marker(index + 1)} opens this section. ${index === 41 ? `It alone mentions the ${NEEDLE}. ` : ""}${"Steady filler text keeps the passage apart from its neighbours. ".repeat(11)}`,
		].join("\n"),
).join("\n\n");

const passages = (page: Page) =>
	page.getByText(
		new RegExp(
			`^${message("assets_point_id_badge", {
				id: "",
			})}`,
		),
	);

const choose = async (page: Page, labelKey: string, option: string) => {
	await page
		.getByRole("combobox", {
			name: message(labelKey),
		})
		.click();
	await page
		.getByRole("option", {
			name: option,
			exact: true,
		})
		.click();
};

test("pipeline: Explore browses a repository with Load more, reads a document in order and finds a passage", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpChatModel(api, inference);
	const member = api.as("member");
	const repository = await repositoryWithDocument(member, {
		label: "Explore Handbook",
		content: document,
	});
	const readiness = await preparedReadiness(member, repository.blockId);
	expect(readiness.totals.ready).toBe(1);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/repositories/${repository.blockId}`);
	await page
		.getByRole("link", {
			name: message("blocks_database_config_explore_action"),
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("heading", {
			name: message("blocks_explore_heading", {
				name: repository.name,
			}),
		}),
	).toBeVisible();

	// Every document: one page of 50, then the rest.
	await expect(
		page.getByText(message("blocks_explore_browse_all_hint")),
	).toBeVisible();
	await expect(passages(page)).toHaveCount(50);
	const loadMore = page.getByRole("button", {
		name: message("blocks_explore_load_more"),
	});
	await loadMore.click();
	await expect(loadMore).toHaveCount(0);
	expect(await passages(page).count()).toBeGreaterThan(50);

	// Choosing the document starts over, in reading order.
	await choose(page, "blocks_explore_document_label", repository.asset.title);
	await expect(
		page.getByText(message("blocks_explore_browse_document_hint")),
	).toBeVisible();
	await expect(passages(page)).toHaveCount(50);
	const order = (
		await page.getByText(/^Marker-\d{3} opens/).allTextContents()
	).map((text) => text.slice(0, 10));
	expect(order.slice(0, 3)).toEqual([
		marker(1),
		marker(2),
		marker(3),
	]);

	// A search ranks the one passage that matches the term first, with its score.
	await page
		.getByRole("searchbox", {
			name: message("blocks_explore_search_label"),
		})
		.fill(NEEDLE);
	await page
		.getByRole("button", {
			name: message("blocks_explore_search_submit"),
		})
		.click();
	await choose(
		page,
		"blocks_explore_mode_label",
		message("blocks_retrieval_mode_sparse_label"),
	);
	await expect(page).toHaveURL(/q=zanzibarquokka/);
	await expect(page).toHaveURL(/mode=sparse/);
	const hits = page
		.getByRole("list", {
			name: message("blocks_explore_search_results_label"),
		})
		.getByRole("listitem");
	const first = hits.first();
	await expect(hits).toHaveCount(1);
	await expect(first.getByText(marker(42))).toBeVisible();
	await expect(first.getByText(/^Score /)).toBeVisible();

	// Back to an earlier search shows its query in the box, and searching again keeps it.
	const searchbox = page.getByRole("searchbox", {
		name: message("blocks_explore_search_label"),
	});
	await searchbox.fill(ABSENT);
	await page
		.getByRole("button", {
			name: message("blocks_explore_search_submit"),
		})
		.click();
	// The URL moves before the page renders the search; wait for its answer.
	await expect(page).toHaveURL(new RegExp(`q=${ABSENT}`));
	await expect(
		page.getByText(message("blocks_explore_search_empty_title")),
	).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/q=zanzibarquokka/);
	await expect(hits).toHaveCount(1);
	await expect(searchbox).toHaveValue(NEEDLE);
	await page
		.getByRole("button", {
			name: message("blocks_explore_search_submit"),
		})
		.click();
	await expect(page).toHaveURL(/q=zanzibarquokka/);
	await expect(first.getByText(marker(42))).toBeVisible();
});
