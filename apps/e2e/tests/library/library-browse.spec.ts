import { randomInt } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import { uploadAsset } from "../../fixtures/assets";
import { grantUser } from "../../fixtures/authz/resources";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const tiles = (page: Page) => page.locator('[data-slot="tile"]');

const tile = (page: Page, name: string) =>
	tiles(page).filter({
		hasText: name,
	});

/** The rail's views, or the chips below `lg`: whichever is shown. */
const views = (page: Page) =>
	page
		.getByRole("navigation", {
			name: message("library_views_label"),
		})
		.filter({
			visible: true,
		});

const view = (page: Page, key: string) =>
	views(page).getByRole("link", {
		name: new RegExp(`^${message(key)}`),
	});

const scope = (page: Page, key: "library_scope_all" | "library_scope_mine") =>
	page
		.getByRole("radiogroup", {
			name: message("library_scope_label"),
		})
		.filter({
			visible: true,
		})
		.getByRole("radio", {
			name: message(key),
		});

const filter = (page: Page, legendKey: string, optionKey: string) =>
	page
		.getByRole("group", {
			name: message(legendKey),
		})
		.filter({
			visible: true,
		})
		.getByRole("radio", {
			name: message(optionKey),
		});

/** Clicks the option's row at its right edge, away from the control and the text. */
const clickRowEnd = async (option: Locator) => {
	const row = option.locator("xpath=ancestor::label");
	const box = await row.boundingBox();
	if (!box) {
		throw new Error("The filter row has no box.");
	}
	await row.click({
		position: {
			x: box.width - 4,
			y: box.height / 2,
		},
	});
};

const sortButton = (page: Page, currentKey: string) =>
	page.getByRole("button", {
		name: `${message("browse_sort_label")}: ${message(currentKey)}`,
	});

/** Opens the sort dropdown and picks an option. */
const sortBy = async (page: Page, optionKey: string) => {
	await page
		.getByRole("button", {
			name: new RegExp(`^${message("browse_sort_label")}: `),
		})
		.click();
	await page
		.getByRole("menuitemradio", {
			name: message(optionKey),
		})
		.click();
};

const scrollTop = (page: Page) =>
	page.evaluate(
		() =>
			(
				globalThis as unknown as {
					scrollY: number;
				}
			).scrollY,
	);

const newMenu = (page: Page) =>
	page
		.getByRole("button", {
			name: message("library_new_action"),
		})
		.first();

const bot = (client: ApiClient, name: string, status: "ready" | "draft") =>
	client.bot.save({
		name,
		description: "Created by the library browse spec.",
		status,
		behaviourId: null,
		repositoryIds: [],
	});

const behaviour = (client: ApiClient, name: string) =>
	client.block.create({
		type: "behaviour",
		name,
		status: "ready",
		config: {
			systemPrompt: "Created by the library browse spec.",
		},
	});

test("library: Mine keeps to what the user can edit across views", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Mine");
	const admin = api.as("admin", org);
	const member = api.as("member", org);
	const memberId = org.users.member.id;
	const id = runId();
	const own = `E2E Own Bot ${id}`;
	const shared = `E2E Shared Bot ${id}`;
	await bot(member, own, "ready");
	const { data: sharedBot } = await bot(admin, shared, "ready");
	await grantUser(
		admin,
		{
			resourceType: "bot",
			resourceId: sharedBot.id,
		},
		memberId,
		"viewer",
	);
	await behaviour(admin, `E2E Shared Behaviour ${id}`).then(({ data }) =>
		grantUser(
			admin,
			{
				resourceType: "block",
				resourceId: data.id,
			},
			memberId,
			"viewer",
		),
	);

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, "/app/library/bots");
	await expect(tile(page, own)).toBeVisible();
	await expect(tile(page, shared)).toBeVisible();
	await expect(view(page, "library_view_bot")).toContainText("2");

	await scope(page, "library_scope_mine").click();
	await expect(page).toHaveURL(/scope=edit/);
	await expect(tile(page, shared)).toHaveCount(0);
	await expect(tile(page, own)).toBeVisible();
	await expect(view(page, "library_view_bot")).toContainText("1");
	await expect(view(page, "library_view_behaviour")).toContainText("0");

	await view(page, "library_view_behaviour").click();
	await expect(page).toHaveURL(/\/app\/library\/behaviours\?scope=edit/);
	await expect(scope(page, "library_scope_mine")).toBeChecked();
	await expect(
		page.getByText(message("library_mine_empty_title")),
	).toBeVisible();

	await scope(page, "library_scope_all").click();
	await expect(page).not.toHaveURL(/scope=/);
	await expect(tile(page, `E2E Shared Behaviour ${id}`)).toBeVisible();
});

test("library: search, filters, sort and page live in the URL and come back on Back", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library URL");
	const member = api.as("member", org);
	const id = runId();
	for (let index = 0; index < 23; index++) {
		await bot(
			member,
			`E2E Url Bot ${id} ${String(index).padStart(2, "0")}`,
			index === 22 ? "draft" : "ready",
		);
	}

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, "/app/library/bots?pageSize=10");
	await expect(tiles(page)).toHaveCount(10);

	await clickRowEnd(
		filter(
			page,
			"library_filter_status_label",
			"library_filter_status_published",
		),
	);
	await expect(page).toHaveURL(/status=ready/);
	await sortBy(page, "browse_sort_name");
	await expect(page).toHaveURL(/sort=name/);
	await expect(sortButton(page, "browse_sort_name")).toBeVisible();
	await page
		.getByRole("button", {
			name: message("common_pagination_next_page_label"),
		})
		.click();
	await expect(page).toHaveURL(/pageIndex=1/);
	await expect(tiles(page).first()).toContainText(`E2E Url Bot ${id} 10`);

	// Every change of the list starts over on its first page.
	await filter(
		page,
		"library_filter_status_label",
		"library_filter_status_all",
	).click();
	await expect(page).not.toHaveURL(/pageIndex=/);
	await page
		.getByRole("button", {
			name: message("common_pagination_next_page_label"),
		})
		.click();
	await expect(page).toHaveURL(/pageIndex=1/);
	await scope(page, "library_scope_mine").click();
	await expect(page).not.toHaveURL(/pageIndex=/);
	await page
		.getByRole("button", {
			name: message("common_pagination_next_page_label"),
		})
		.click();
	await expect(page).toHaveURL(/pageIndex=1/);
	await page
		.getByRole("textbox", {
			name: message("library_search_placeholder"),
		})
		.fill(`${id} 2`);
	await expect(page).toHaveURL(/query=/);
	await expect(page).not.toHaveURL(/pageIndex=/);
	await expect(tiles(page)).toHaveCount(3);

	// The detail's Back returns to the same results at the same scroll position.
	await page.setViewportSize({
		width: 1280,
		height: 500,
	});
	const target = tile(page, `E2E Url Bot ${id} 22`);
	await target.scrollIntoViewIfNeeded();
	const scrolled = await scrollTop(page);
	expect(scrolled).toBeGreaterThan(0);
	const url = page.url();
	await target
		.getByRole("link", {
			name: `E2E Url Bot ${id} 22`,
		})
		.click();
	await expect(page).toHaveURL(/\/app\/library\/bots\/[^?]+$/);
	await page.goBack();
	await expect(page).toHaveURL(url);
	await expect(tiles(page)).toHaveCount(3);
	await expect.poll(() => scrollTop(page)).toBeCloseTo(scrolled, -1);
});

test("library: the overview searches every kind in one list", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Search");
	const member = api.as("member", org);
	const id = runId();
	await bot(member, `E2E Find ${id} bot`, "ready");
	await behaviour(member, `E2E Find ${id} behaviour`);
	await uploadAsset(member, `E2E Find ${id} asset`);
	await bot(member, `E2E Other ${id}`, "ready");

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, `/app/library?query=${encodeURIComponent(`Find ${id}`)}`);
	await expect(
		page.getByRole("heading", {
			name: message("library_search_results_title"),
		}),
	).toContainText("3");
	await expect(tiles(page)).toHaveCount(3);
	await expect(view(page, "library_view_bot")).toContainText("1");
	await expect(view(page, "library_view_asset")).toContainText("1");

	// A view narrows the search to its kind.
	await view(page, "library_view_behaviour").click();
	await expect(page).toHaveURL(/\/app\/library\/behaviours\?query=/);
	await expect(tiles(page)).toHaveCount(1);
	await expect(tile(page, `E2E Find ${id} behaviour`)).toBeVisible();
});

test("library: a digit-only search from the address stays the search", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Digits");
	const member = api.as("member", org);
	const digits = String(randomInt(100_000_000, 1_000_000_000));
	await bot(member, `E2E Digits ${digits}`, "ready");
	await bot(member, "E2E Digits other", "ready");

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots?query=${digits}`);
	await expect(page).toHaveURL(new RegExp(`query=${digits}`));
	await expect(
		page.getByRole("textbox", {
			name: message("library_search_placeholder"),
		}),
	).toHaveValue(digits);
	await expect(tiles(page)).toHaveCount(1);
	await expect(tile(page, `E2E Digits ${digits}`)).toBeVisible();
});

test("library: the failed processing filter shows a failed asset and why", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Failed");
	const member = api.as("member", org);
	const title = `E2E Failed Asset ${runId()}`;
	// Without workers, queueing fails and the upload ends up failed.
	const asset = await uploadAsset(member, title);
	let failure: string | null = null;
	await expect
		.poll(async () => {
			const { data } = await member.asset.find({
				id: asset.id,
			});
			failure =
				data.processingStatus === "failed"
					? (data.processingFailure ?? "other")
					: null;
			return failure;
		})
		.not.toBeNull();

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, "/app/library/assets");
	await filter(
		page,
		"library_filter_processing_label",
		"library_filter_processing_failed",
	).click();
	await expect(page).toHaveURL(/processing=failed/);
	await expect(
		tile(page, title).getByText(message(`pipeline_failure_${failure}`)),
	).toBeVisible();

	await filter(
		page,
		"library_filter_processing_label",
		"library_filter_processing_running",
	).click();
	await expect(tile(page, title)).toHaveCount(0);
});

test("library: New offers what the user may create, and the empty library says so", async ({
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Empty");

	const member = await pageAs("member", org);
	await enterApp(member, org.slug);
	await open(member, "/app/library");
	await expect(member.getByText(message("library_empty_title"))).toBeVisible();
	await expect(
		member.getByText(message("library_empty_create_description")),
	).toBeVisible();
	await newMenu(member).click();
	for (const key of [
		"library_new_bot_action",
		"library_new_behaviour_action",
		"library_new_repository_action",
		"library_new_upload_action",
	]) {
		await expect(
			member.getByRole("menuitem", {
				name: message(key),
			}),
		).toBeVisible();
	}
	await member
		.getByRole("menuitem", {
			name: message("library_new_repository_action"),
		})
		.click();
	await expect(member).toHaveURL(/\/app\/library\/repositories\/add$/);

	const viewer = await pageAs("viewer", org);
	await enterApp(viewer, org.slug);
	await open(viewer, "/app/library");
	await expect(
		viewer.getByText(message("library_empty_read_description")),
	).toBeVisible();
	await expect(
		viewer.getByRole("button", {
			name: message("library_new_action"),
		}),
	).toHaveCount(0);
});

test("library: a tile is one tab stop, then its star and menu", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Keyboard");
	const member = api.as("member", org);
	const name = `E2E Keyboard Bot ${runId()}`;
	await bot(member, name, "ready");

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, "/app/library/bots");
	const link = tile(page, name).getByRole("link", {
		name,
	});
	await link.focus();
	await page.keyboard.press("Tab");
	const star = page.getByRole("button", {
		name: message("bots_favourite_toggle_label", {
			name,
		}),
	});
	await expect(star).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(star).toHaveAttribute("aria-pressed", "true");
	await expect(page).toHaveURL(/\/app\/library\/bots$/);
	await page.keyboard.press("Tab");
	await expect(
		tile(page, name).getByRole("button", {
			name: message("common_more_actions"),
		}),
	).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/app\/library\/bots\/[^/]+$/);
});

test("library: at 390 px the switch, chips, Filters drawer and full-width tiles", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("E2E Library Mobile");
	const member = api.as("member", org);
	const name = `E2E Mobile Bot ${runId()}`;
	await bot(member, name, "draft");

	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await page.setViewportSize({
		width: 390,
		height: 844,
	});
	await open(page, "/app/library/bots");
	await expect(scope(page, "library_scope_all")).toBeVisible();
	await expect(view(page, "library_view_asset")).toBeAttached();

	const filters = page.getByRole("button", {
		name: message("browse_filters_action"),
	});
	await filters.click();
	const drawer = page.getByRole("dialog", {
		name: message("browse_filters_title"),
	});
	await clickRowEnd(
		drawer.getByRole("radio", {
			name: message("library_filter_status_drafts"),
		}),
	);
	await expect(page).toHaveURL(/status=draft/);
	await page.keyboard.press("Escape");
	await expect(drawer).toBeHidden();
	const counted = page.getByRole("button", {
		name: message("browse_filters_count_action", {
			count: 1,
		}),
	});
	await expect(counted).toBeFocused();

	const box = await tile(page, name).boundingBox();
	expect(box?.width).toBeGreaterThan(350);
	await expect(sortButton(page, "browse_sort_newest")).toBeVisible();
});
