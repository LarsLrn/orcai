import type { Page } from "@playwright/test";
import { untilAllowed } from "../../fixtures/authorization";
import {
	chatName,
	sendTurn,
	setUpChatModel,
	skipChatTour,
} from "../../fixtures/chat/chat";
import type { Api } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId, type WorkerOrganisation } from "../../fixtures/organisation";

const tiles = (page: Page) => page.locator('[data-slot="tile"]');

const scrollTop = (page: Page) =>
	page.evaluate(
		() =>
			(
				globalThis as unknown as {
					scrollY: number;
				}
			).scrollY,
	);

const stepHeading = (
	page: Page,
	position: number,
	count: number,
	stepKey: string,
) =>
	page.getByRole("heading", {
		name: message("catalogue_wizard_step_heading", {
			position,
			count,
			step: message(stepKey),
		}),
	});

/** The `api` fixture acting in another of the worker's organisations. */
const apiIn = (api: Api, organisation: WorkerOrganisation): Api => ({
	as: (role) => api.as(role, organisation),
	asWellKnownAdmin: api.asWellKnownAdmin,
});

test("catalogue: a listed bot is added to another organisation, chats there on its model and turns read-only when unlisted", async ({
	api,
	inference,
	org,
	orgs,
	pageAs,
}) => {
	test.slow();

	const id = runId();
	const member = api.as("member");
	const authorModel = await setUpChatModel(api, inference);
	const behaviour = await member.block.create({
		type: "behaviour",
		name: `E2E Catalogue Behaviour ${id}`,
		status: "ready",
		config: {
			systemPrompt: "Answer like a writing tutor.",
		},
	});
	const { data: bot } = await member.bot.save({
		name: `E2E Catalogue Bot ${id}`,
		description: "Listed by the catalogue spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	await member.botSetup.save({
		botId: bot.id,
		setup: {
			modelId: authorModel.modelId,
			strength: "recommended",
			generation: {},
		},
	});

	// Listing the bot names the behaviour it lists along.
	const author = await pageAs("member");
	await enterApp(author, org.slug);
	await open(author, `/app/library/bots/${bot.id}`);
	await author
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await author
		.getByRole("menuitem", {
			name: message("access_list_action"),
		})
		.click();
	const confirmListing = author.getByRole("alertdialog");
	await expect(
		confirmListing.getByText(
			message("access_publish_confirm_blocks", {
				blockNames: behaviour.data.name,
			}),
		),
	).toBeVisible();
	await confirmListing
		.getByRole("button", {
			name: message("access_publish_confirm_button"),
		})
		.click();
	await expect(confirmListing).toBeHidden();

	// The other organisation's admin finds it, opens its page and adds it.
	const other = await orgs.create(`E2E Catalogue ${id}`);
	const otherModel = await setUpChatModel(apiIn(api, other), inference);
	const page = await pageAs("admin", other);
	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/bots?query=${id}`);
	await expect(tiles(page)).toHaveCount(1);
	await page
		.getByRole("link", {
			name: bot.name,
		})
		.click();
	await expect(page).toHaveURL(
		new RegExp(`/app/catalogue/bots/${bot.id}\\?from=`),
	);
	await expect(
		page.getByRole("heading", {
			name: bot.name,
		}),
	).toBeVisible();
	await expect(page.getByText(behaviour.data.name)).toBeVisible();
	await page
		.getByRole("button", {
			name: message("catalogue_add_action", {
				organisation: other.name,
			}),
		})
		.click();

	// The wizard: share with every member, then keep the author's pick. A
	// reload keeps where it came from.
	await expect(page).toHaveURL(
		new RegExp(`/app/catalogue/bots/${bot.id}/add\\?from=`),
	);
	await page.reload();
	await page
		.getByText(message("access_principal_picker_system_badge"), {
			exact: true,
		})
		.click();
	await page
		.getByRole("button", {
			name: message("access_manager_grant_action"),
		})
		.click();
	await expect(
		page.getByRole("button", {
			name: message("access_manager_grant_action"),
		}),
	).toBeDisabled();
	// Finish waits for the model form; each step takes focus from the keyboard.
	const release: (() => void)[] = [];
	const setupHeld = new Promise<void>((resolve) => {
		release.push(resolve);
	});
	const releaseSetup = () => {
		for (const resolve of release) resolve();
	};
	await page.route("**/api/rpc/botSetup/find**", async (route) => {
		await setupHeld;
		await route.continue();
	});
	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.press("Enter");
	await expect(
		stepHeading(page, 2, 3, "catalogue_wizard_step_model"),
	).toBeFocused();
	const finish = page.getByRole("button", {
		name: message("catalogue_wizard_finish_action"),
	});
	await expect(finish).toBeDisabled();
	await expect(
		page.getByRole("button", {
			name: message("catalogue_wizard_skip_action"),
		}),
	).toBeEnabled();
	releaseSetup();
	await expect(
		page.getByText(message("bot_setup_authors_pick_preselected")),
	).toBeVisible();
	await expect(finish).toBeEnabled();
	await finish.press("Enter");
	await expect(
		stepHeading(page, 3, 3, "catalogue_wizard_step_done"),
	).toBeFocused();
	await expect(
		page.getByRole("heading", {
			name: message("catalogue_wizard_done_title", {
				name: bot.name,
				organisation: other.name,
			}),
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("bots_detail_start_chat_action"),
		}),
	).toBeVisible();

	// Back to catalogue returns to the search it started from.
	await page
		.getByRole("link", {
			name: message("catalogue_wizard_back_to_catalogue_action"),
		})
		.click();
	await expect(page).toHaveURL(
		new RegExp(`/app/catalogue/bots\\?query=${id}$`),
	);
	await expect(tiles(page)).toHaveCount(1);

	// A member of the other organisation chats on its own model.
	const otherMember = api.as("member", other);
	// The grant was written in the browser, whose revision this client has not seen.
	const chat = await untilAllowed(() =>
		otherMember.chat.create({
			botId: bot.id,
			title: chatName("Catalogue Chat"),
		}),
	);
	const found = await otherMember.chat.find({
		id: chat.data.id,
	});
	expect(found.data.effectiveModel?.modelId).toBe(otherModel.modelId);
	await sendTurn({
		client: otherMember,
		inference,
		chatId: chat.data.id,
		turn: {
			question: "Can you check my reference list?",
			reply: "Yes, paste it here.",
		},
	});

	// Unlisting removes it from the organisation: the chat stays readable but read-only.
	await member.resource.setVisibility({
		resourceType: "bot",
		resourceId: bot.id,
		visibility: "private",
		listBlockIds: [],
	});
	const reader = await pageAs("member", other);
	await enterApp(reader, other.slug);
	await skipChatTour(reader);
	await open(reader, `/app/chat/${chat.data.id}`);
	await expect(
		reader.getByText(message("chat_read_only_bot_unavailable_title")),
	).toBeVisible();
	await expect(
		reader.getByRole("textbox", {
			name: message("chat_composer_aria_label"),
		}),
	).toHaveCount(0);
});

test("catalogue: an entry's page is a page of its own, and Back restores the grid", async ({
	api,
	orgs,
	pageAs,
}) => {
	const id = runId();
	const author = api.as("member");
	for (const index of Array.from(
		{
			length: 24,
		},
		(_, position) => position,
	)) {
		const block = await author.block.create({
			type: "behaviour",
			name: `E2E Catalogue Grid ${id} ${String(index).padStart(2, "0")}`,
			status: "ready",
			config: {
				systemPrompt: `Behaviour ${String(index)} of the grid.`,
			},
		});
		await author.resource.setVisibility({
			resourceType: "block",
			resourceId: block.data.id,
			visibility: "public",
			listBlockIds: [],
		});
	}

	const other = await orgs.create(`E2E Catalogue Grid ${id}`);
	const page = await pageAs("member", other);
	await enterApp(page, other.slug);
	await page.setViewportSize({
		width: 1280,
		height: 500,
	});
	await open(page, `/app/catalogue/behaviours?query=${id}&sort=name`);
	await expect(tiles(page)).toHaveCount(20);
	const name = `E2E Catalogue Grid ${id} 17`;
	const target = tiles(page).filter({
		hasText: name,
	});
	await target.scrollIntoViewIfNeeded();
	const scrolled = await scrollTop(page);
	expect(scrolled).toBeGreaterThan(0);
	const url = page.url();
	await target
		.getByRole("link", {
			name,
		})
		.click();

	// The page shows the prompt to judge it by; a member cannot add it.
	await expect(page).toHaveURL(/\/app\/catalogue\/behaviours\/[^?/]+\?from=/);
	await expect(page.getByText("Behaviour 17 of the grid.")).toBeVisible();
	await expect(
		page.getByText(
			message("catalogue_detail_ask_adder", {
				organisation: other.name,
			}),
		),
	).toBeVisible();

	// The wizard is for admins and managers only, also when opened directly.
	await open(page, `${new URL(page.url()).pathname}/add`);
	await expect(
		page.getByRole("heading", {
			name: message("boundaries_not_found_title"),
		}),
	).toBeVisible();
	await page.goBack();

	await page.goBack();
	await expect(page).toHaveURL(url);
	await expect(tiles(page)).toHaveCount(20);
	await expect.poll(() => scrollTop(page)).toBeCloseTo(scrolled, -1);
});

/** A listed bot with a behaviour and a repository, made in the worker's organisation. */
const listedBotWithBlocks = async (api: Api) => {
	const id = runId();
	const author = api.as("member");
	const behaviour = await author.block.create({
		type: "behaviour",
		name: `E2E Catalogue Blocks Behaviour ${id}`,
		status: "ready",
		config: {
			systemPrompt: "Answer from the handbook.",
		},
	});
	const repository = await author.block.create({
		type: "repository",
		name: `E2E Catalogue Blocks Repository ${id}`,
		status: "ready",
		assets: [],
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	const { data: bot } = await author.bot.save({
		name: `E2E Catalogue Blocks Bot ${id}`,
		description: "Listed with its blocks by the catalogue spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [
			repository.data.id,
		],
	});
	await author.resource.setVisibility({
		resourceType: "bot",
		resourceId: bot.id,
		visibility: "public",
		listBlockIds: [
			behaviour.data.id,
			repository.data.id,
		],
	});
	return {
		id,
		bot,
		behaviour: behaviour.data,
		repository: repository.data,
	};
};

test("catalogue: adding a bot with its blocks puts its behaviour and repository in the Library", async ({
	api,
	orgs,
	pageAs,
}) => {
	const { id, bot, behaviour, repository } = await listedBotWithBlocks(api);

	const other = await orgs.create(`E2E Catalogue Blocks ${id}`);
	const page = await pageAs("admin", other);
	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/bots/${bot.id}`);
	const withBlocks = page.getByRole("checkbox", {
		name: `Also add its behaviour and its repository to ${other.name}`,
	});
	await expect(withBlocks).not.toBeChecked();
	await withBlocks.check();
	await page
		.getByRole("button", {
			name: message("catalogue_add_action", {
				organisation: other.name,
			}),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/app/catalogue/bots/${bot.id}/add`));

	await open(page, `/app/library?query=${id}`);
	for (const name of [
		bot.name,
		behaviour.name,
		repository.name,
	])
		await expect(
			page.getByRole("link", {
				name,
			}),
		).toBeVisible();
});

test("catalogue: a bot added without its blocks gets them from its Library menu", async ({
	api,
	orgs,
	pageAs,
}) => {
	const { id, bot, behaviour, repository } = await listedBotWithBlocks(api);
	const other = await orgs.create(`E2E Catalogue Later ${id}`);
	await apiIn(api, other)
		.as("admin")
		.catalogue.add({
			entry: {
				resourceType: "bot",
				resourceId: bot.id,
			},
		});
	const label = `Add its behaviour and its repository to ${other.name}`;

	const page = await pageAs("admin", other);
	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/bots/${bot.id}`);
	await expect(
		page.getByRole("button", {
			name: label,
		}),
	).toBeVisible();

	await open(page, `/app/library/bots/${bot.id}`);
	await page
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: label,
		})
		.click();
	await expect(
		page.getByText(`2 blocks of ${bot.name} are in ${other.name} now`),
	).toBeVisible();

	await open(page, `/app/library?query=${id}`);
	for (const name of [
		behaviour.name,
		repository.name,
	])
		await expect(
			page.getByRole("link", {
				name,
			}),
		).toBeVisible();
	await open(page, `/app/catalogue/bots/${bot.id}`);
	await expect(
		page.getByRole("link", {
			name: message("catalogue_open_in_library_action"),
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: label,
		}),
	).toHaveCount(0);
});

test("catalogue: the sort dropdown orders the grid and the filter card's toggle lives in the URL", async ({
	api,
	orgs,
	pageAs,
}) => {
	const id = runId();
	const author = api.as("member");
	for (const letter of [
		"A",
		"B",
	]) {
		const block = await author.block.create({
			type: "behaviour",
			name: `E2E Catalogue Sort ${id} ${letter}`,
			status: "ready",
			config: {
				systemPrompt: `Behaviour ${letter} of the sort.`,
			},
		});
		await author.resource.setVisibility({
			resourceType: "block",
			resourceId: block.data.id,
			visibility: "public",
			listBlockIds: [],
		});
	}

	const other = await orgs.create(`E2E Catalogue Sort ${id}`);
	const page = await pageAs("member", other);
	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/behaviours?query=${id}`);
	await expect(tiles(page)).toHaveCount(2);
	await expect(tiles(page).first()).toContainText(`Sort ${id} B`);

	await page
		.getByRole("button", {
			name: `${message("browse_sort_label")}: ${message("browse_sort_newest")}`,
		})
		.click();
	await page
		.getByRole("menuitemradio", {
			name: message("browse_sort_name"),
		})
		.click();
	await expect(page).toHaveURL(/sort=name/);
	await expect(tiles(page).first()).toContainText(`Sort ${id} A`);
	await expect(
		page.getByRole("button", {
			name: `${message("browse_sort_label")}: ${message("browse_sort_name")}`,
		}),
	).toBeVisible();

	const hideAdded = page
		.getByRole("group", {
			name: message("catalogue_filter_status_label"),
		})
		.getByRole("checkbox", {
			name: message("catalogue_filter_hide_added"),
		});
	await hideAdded.click();
	await expect(page).toHaveURL(/hideAdded=true/);
	await expect(hideAdded).toBeChecked();
	await expect(tiles(page)).toHaveCount(2);
});
