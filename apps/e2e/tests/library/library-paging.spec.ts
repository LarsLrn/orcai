import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

// Two cards per page, so three items span two pages.
const PAGE_SIZE = 2;

type Locale = "en" | "de";

const cards = (page: Page) => page.locator('[data-slot="tile"]');

const pagerButton = (page: Page, key: string, locale: Locale) =>
	page.getByRole("button", {
		name: message(key, {}, locale),
	});

/** Pages the grid from its first page to its last, checking the card counts. */
const reachLastPage = async (page: Page, locale: Locale) => {
	await expect(cards(page)).toHaveCount(PAGE_SIZE);
	await expect(
		page.getByText(
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

	await pagerButton(page, "common_pagination_next_page_label", locale).click();
	await expect(cards(page)).toHaveCount(1);
	await expect(
		pagerButton(page, "common_pagination_next_page_label", locale),
	).toBeDisabled();
};

const names = (kind: string, id: string) =>
	[
		"A",
		"B",
		"C",
	].map((suffix) => `E2E Pager ${kind} ${id} ${suffix}`);

const behaviour = (name: string, status: "ready" | "draft") => ({
	type: "behaviour" as const,
	name,
	status,
	config: {
		systemPrompt: "Created by the library paging spec.",
	},
});

const grids = [
	{
		kind: "assets",
		path: "/app/library/assets",
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
		path: "/app/library/behaviours",
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.block.create(behaviour(title, "ready"));
			}
		},
	},
	{
		kind: "repositories",
		path: "/app/library/repositories",
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.block.create({
					type: "repository",
					name: title,
					status: "ready",
					assets: [],
					config: {
						minPassages: 1,
						maxPassages: 5,
						defaultPassages: 3,
					},
				});
			}
		},
	},
	{
		kind: "bots",
		path: "/app/library/bots",
		lastOf: (titles: string[]) => titles[0],
		seed: async (member: ApiClient, titles: string[]) => {
			for (const title of titles) {
				await member.bot.save({
					name: title,
					description: "Created by the library paging spec.",
					status: "ready",
					behaviourId: null,
					repositoryIds: [],
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
			await reachLastPage(page, locale);
			await expect(cards(page).getByText(grid.lastOf(titles))).toBeVisible();
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

test("library: published bots and the user's drafts page together, newest first", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Statuses");
	const member = api.as("member", org);
	const id = runId();
	const [published, draft] = [
		names("Bot", id),
		names("Draft", id),
	];
	await member.bot.save({
		name: published[0],
		description: "Created by the library paging spec.",
		status: "ready",
		behaviourId: null,
		repositoryIds: [],
	});
	await member.bot.save({
		name: draft[0],
		description: "Created by the library paging spec.",
		status: "draft",
		behaviourId: null,
		repositoryIds: [],
	});
	await member.bot.save({
		name: published[1],
		description: "Created by the library paging spec.",
		status: "ready",
		behaviourId: null,
		repositoryIds: [],
	});

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots?pageSize=${PAGE_SIZE}`);
	await expect(cards(page).first()).toContainText(published[1]);
	await expect(cards(page).nth(1)).toContainText(draft[0]);
	await reachLastPage(page, "en");
	await expect(cards(page).getByText(published[0])).toBeVisible();
	await expect(page).toHaveURL(/pageIndex=1/);
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
			behaviourId: null,
			repositoryIds: [],
		});
	}

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);

	// Nothing matches at all: no grid is rendered, the URL is still fixed.
	await open(page, "/app/library/bots?status=ready&pageIndex=9");
	await expect(page).not.toHaveURL(/[?&]pageIndex=/);

	// The last bot of the last page goes away.
	await open(page, `/app/library/bots?pageIndex=1&pageSize=${PAGE_SIZE}`);
	await expect(cards(page)).toHaveCount(1);
	await cards(page)
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("bots_delete_action"),
		})
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", {
			name: /^Delete/,
		})
		.click();
	await expect(cards(page)).toHaveCount(PAGE_SIZE);
	await expect(page).not.toHaveURL(/[?&]pageIndex=/);
});
