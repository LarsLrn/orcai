import type { Locator, Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

// Two cards per page, so three items span two pages.
const PAGE_SIZE = 2;

type Locale = "en" | "de";

const section = (page: Page, titleKey: string, locale: Locale) =>
	page.locator("section", {
		has: page.getByRole("heading", {
			name: message(titleKey, {}, locale),
			exact: true,
		}),
	});

const cards = (scope: Locator) => scope.locator('[data-slot="card"]');

const pagerButton = (scope: Locator, key: string, locale: Locale) =>
	scope.getByRole("button", {
		name: message(key, {}, locale),
	});

/** Pages `scope` from its first page to its last, checking the card counts. */
const reachLastPage = async (scope: Locator, locale: Locale) => {
	await expect(cards(scope)).toHaveCount(PAGE_SIZE);
	await expect(
		scope.getByText(
			message(
				"data_table_pagination_position",
				{
					page: 1,
					pageCount: 2,
				},
				locale,
			),
		),
	).toBeVisible();

	await pagerButton(scope, "common_pagination_next_page_label", locale).click();
	await expect(cards(scope)).toHaveCount(1);
	await expect(
		pagerButton(scope, "common_pagination_next_page_label", locale),
	).toBeDisabled();
};

const names = (kind: string, id: string) =>
	[
		"A",
		"B",
		"C",
	].map((suffix) => `E2E Pager ${kind} ${id} ${suffix}`);

const template = (name: string, status: "ready" | "draft") => ({
	type: "template" as const,
	name,
	status,
	config: {
		systemPrompt: "Created by the library paging spec.",
	},
});

const grids = [
	{
		kind: "assets",
		path: "/app/hub/assets",
		titleKey: "assets_list_title",
		// Newest first: the oldest is on the last page.
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await uploadAsset(member, title);
			}
		},
	},
	{
		kind: "behaviour",
		path: "/app/hub/behaviour",
		titleKey: "behaviour_published_title",
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.block.create(template(title, "ready"));
			}
		},
	},
	{
		kind: "repositories",
		path: "/app/hub/repositories",
		titleKey: "blocks_repositories_published_section_title",
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.block.create({
					type: "database",
					name: title,
					status: "ready",
					assets: [],
					config: {
						minReferences: 1,
						maxReferences: 5,
						defaultReferences: 3,
					},
				});
			}
		},
	},
	{
		kind: "bots",
		path: "/app/hub/bots",
		titleKey: "bots_list_published_title",
		// Listed by name: the last one is on the last page.
		lastOf: (titles: string[]) => titles[2],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.bot.save({
					name: title,
					description: "Created by the library paging spec.",
					status: "ready",
					templateBlockId: null,
					databaseBlockIds: [],
				});
			}
		},
	},
];

for (const grid of grids) {
	test(`library: ${grid.kind} reach the last page at 1280 px, 390 px and in German`, async ({
		api,
		appBaseURL,
		orgs,
		pageAs,
	}) => {
		const org = await orgs.create("E2E Library Paging");
		const titles = names(grid.kind, runId());
		await grid.seed(api.as("member", org), titles);

		const page = await pageAs("member", org);
		await enterApp(page, org.slug);
		const reach = async (locale: Locale) => {
			await open(page, `${grid.path}?pageSize=${PAGE_SIZE}`);
			const scope = section(page, grid.titleKey, locale);
			await reachLastPage(scope, locale);
			await expect(scope.getByText(grid.lastOf(titles))).toBeVisible();
			await expect(page).toHaveURL(/pageIndex=1/);
		};

		await page.setViewportSize({
			width: 1280,
			height: 800,
		});
		await reach("en");

		await page.setViewportSize({
			width: 390,
			height: 844,
		});
		await reach("en");

		await page.context().addCookies([
			{
				name: "PARAGLIDE_LOCALE",
				value: "de",
				url: appBaseURL,
			},
		]);
		await reach("de");
	});
}

test("library: bots page their draft grid on its own", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Drafts");
	const member = api.as("member", org);
	const id = runId();
	for (const name of names("Bot", id)) {
		await member.bot.save({
			name,
			description: "Created by the library paging spec.",
			status: "ready",
			templateBlockId: null,
			databaseBlockIds: [],
		});
	}
	const drafts = names("Draft", id);
	for (const name of drafts) {
		await member.bot.save({
			name,
			description: "Created by the library paging spec.",
			status: "draft",
			templateBlockId: null,
			databaseBlockIds: [],
		});
	}

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, `/app/hub/bots?pageSize=${PAGE_SIZE}`);
	const draftGrid = section(page, "bots_list_drafts_title", "en");
	await reachLastPage(draftGrid, "en");
	await expect(draftGrid.getByText(drafts[2])).toBeVisible();
	await expect(page).toHaveURL(/draftPageIndex=1/);
	await expect(page).not.toHaveURL(/[?&]pageIndex=/);
	await expect(
		cards(section(page, "bots_list_published_title", "en")),
	).toHaveCount(PAGE_SIZE);
});

test("library: a page index past the last page is replaced by the last page", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Stale Page");
	const member = api.as("member", org);
	const drafts = names("Draft", runId());
	for (const name of drafts) {
		await member.bot.save({
			name,
			description: "Created by the library paging spec.",
			status: "draft",
			templateBlockId: null,
			databaseBlockIds: [],
		});
	}

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);

	// No published bot at all: the grid is not rendered, the URL is still fixed.
	await open(page, `/app/hub/bots?pageIndex=9&pageSize=${PAGE_SIZE}`);
	await expect(page).not.toHaveURL(/[?&]pageIndex=/);

	// The last draft of the last page goes away.
	await open(page, `/app/hub/bots?draftPageIndex=1&pageSize=${PAGE_SIZE}`);
	const draftGrid = section(page, "bots_list_drafts_title", "en");
	await expect(cards(draftGrid)).toHaveCount(1);
	await cards(draftGrid)
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("bots_list_draft_delete_action"),
		})
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", {
			name: /^Delete/,
		})
		.click();
	await expect(cards(draftGrid)).toHaveCount(PAGE_SIZE);
	await expect(page).not.toHaveURL(/draftPageIndex=/);

	// Every draft deleted: the section disappears and the URL stays clean.
	await open(page, `/app/hub/bots?draftPageIndex=5&pageSize=${PAGE_SIZE}`);
	await expect(page).not.toHaveURL(/draftPageIndex=/);
});
