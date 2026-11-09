import type { Page } from "@playwright/test";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import {
	preparedReadiness,
	repositoryWithAsset,
} from "../../fixtures/pipeline/repository";

const SECTIONS = 70;
const NEEDLE = "zanzibarquokka";
/** A term no passage contains. */
const ABSENT = "marmaladequasar";

const marker = (index: number) => `Marker-${String(index).padStart(3, "0")}`;

/** Sections of about 700 characters, so the chunker (1,000 at most) keeps one per passage. */
const asset = Array.from(
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

test("pipeline: Explore browses a repository with Load more, reads an asset in order and finds a passage", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpChatModel(api, inference);
	const member = api.as("member");
	const repository = await repositoryWithAsset(member, {
		label: "Explore Handbook",
		content: asset,
	});
	const readiness = await preparedReadiness(member, repository.blockId);
	expect(readiness.totals.ready).toBe(1);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/repositories/${repository.blockId}`);
	await page
		.getByRole("link", {
			name: message("blocks_repository_config_explore_action"),
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

	// Every asset: one page of 50, then the rest.
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

	// Choosing the asset starts over, in reading order.
	await choose(page, "blocks_explore_asset_label", repository.asset.title);
	await expect(
		page.getByText(message("blocks_explore_browse_asset_hint")),
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

	// A search runs as you type and ranks the one passage that matches the term first, with its score.
	const searchbox = page.getByRole("textbox", {
		name: message("blocks_explore_search_label"),
	});
	await searchbox.fill(NEEDLE);
	await expect(page).toHaveURL(/query=zanzibarquokka/);
	await choose(
		page,
		"blocks_explore_mode_label",
		message("blocks_retrieval_mode_sparse_label"),
	);
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

	// Typing changes the search in place; Back returns to the step before and shows its query.
	await choose(
		page,
		"blocks_explore_top_k_label",
		message("blocks_explore_top_k_option", {
			count: 25,
		}),
	);
	await expect(page).toHaveURL(/k=25/);
	await searchbox.fill(ABSENT);
	// The URL moves before the page renders the search; wait for its answer.
	await expect(page).toHaveURL(new RegExp(`query=${ABSENT}`));
	await expect(
		page.getByText(message("blocks_explore_search_empty_title")),
	).toBeVisible();
	await page.goBack();
	await expect(page).not.toHaveURL(/k=25/);
	await expect(page).toHaveURL(/query=zanzibarquokka/);
	await expect(searchbox).toHaveValue(NEEDLE);
	await expect(hits).toHaveCount(1);
	await expect(first.getByText(marker(42))).toBeVisible();

	// Clearing the search browses the asset again.
	await page
		.getByRole("button", {
			name: message("data_table_search_clear_label"),
		})
		.click();
	await expect(page).not.toHaveURL(/query=/);
	await expect(
		page.getByText(message("blocks_explore_browse_asset_hint")),
	).toBeVisible();
	await expect(passages(page)).toHaveCount(50);
});
