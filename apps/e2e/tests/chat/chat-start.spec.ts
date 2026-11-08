import { INFERENCE_MOCK_MODELS } from "@orcai/ai/testing";
import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { adoptPageZedToken } from "../../fixtures/authz/resources";
import {
	chatName,
	composer,
	messageText,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const BOT_LIST = "**/api/rpc/bot/list**";

const openBotSelector = async (page: Page) => {
	await page
		.getByRole("button", {
			name: message("chat_bot_selector_no_bot_title"),
		})
		.click();
	const dialog = page.getByRole("dialog", {
		name: message("chat_bot_selector_dialog_title"),
	});
	return {
		dialog,
		search: dialog.getByPlaceholder(
			message("chat_bot_selector_search_placeholder"),
		),
	};
};

test("chat: Start a chat opens the composer, where a picked bot starts the chat", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpChatModel(api, inference);
	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: chatName("Start Behaviour"),
		status: "ready",
		config: {
			systemPrompt: "Created by the chat start spec.",
		},
	});
	const { data: bot } = await member.bot.save({
		name: chatName("Start Bot"),
		description: "Created by the chat start spec.",
		status: "draft",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	await member.bot.publish({
		id: bot.id,
	});
	for (const tourId of [
		"initialTour",
		"chatTour",
	] as const) {
		await member.user.setTourState({
			tourId,
			state: "completed",
		});
	}
	inference.respondWith({
		text: "Hello from the bot.",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/chat");
	await page
		.getByRole("main")
		.getByRole("link", {
			name: message("chat_start_action"),
		})
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/chat\/new$/);

	await open(page, "/app");
	await page
		.locator('[data-sidebar="sidebar"]')
		.getByRole("link", {
			name: message("sidebar_start_chat_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/chat\/new$/);
	await expect(
		page.getByRole("button", {
			name: INFERENCE_MOCK_MODELS.chat,
		}),
	).toBeVisible();

	const { dialog, search } = await openBotSelector(page);
	await search.fill(bot.name);
	await dialog
		.getByRole("option", {
			name: bot.name,
		})
		.click();
	await expect(dialog).toBeHidden();
	await expect(
		page.getByRole("button", {
			name: bot.name,
		}),
	).toBeVisible();

	await composer(page).fill("Hello, bot.");
	await composer(page).press("Enter");
	await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]{36}/);
	const chatId = new URL(page.url()).pathname.split("/").at(-1) as ChatId;
	await expect(messageText(page, "Hello from the bot.")).toBeVisible();
	await adoptPageZedToken(page, zedTokens);
	const { data: chat } = await member.chat.find({
		id: chatId,
	});
	expect(chat.botId).toBe(bot.id);
});

test("chat: a failed bot list in the composer shows the error and loads again on retry", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: `E2E Selector Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the chat start spec.",
		},
	});
	const { data: bot } = await member.bot.save({
		name: `E2E Selector Bot ${runId()}`,
		description: "Created by the chat start spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/chat/new");
	await page.clock.install();
	await page.route(BOT_LIST, (route) => route.abort());

	const { dialog, search } = await openBotSelector(page);
	const failure = dialog.getByRole("alert");
	// Fast-forwards the query's retry backoff until it gives up.
	await expect(async () => {
		await page.clock.fastForward(4_000);
		await expect(failure).toContainText(message("error_generic_unknown"), {
			timeout: 100,
		});
	}).toPass({
		intervals: [
			100,
		],
	});
	await expect(
		dialog.getByText(message("chat_bot_selector_empty_state")),
	).toBeHidden();

	await page.unroute(BOT_LIST);
	await failure
		.getByRole("button", {
			name: message("common_retry_button"),
		})
		.click();
	await expect(failure).toBeHidden();
	await search.fill(bot.name);
	await page.clock.fastForward(500);
	await expect(
		dialog.getByRole("option", {
			name: bot.name,
		}),
	).toBeVisible();

	await search.fill(`E2E No Match ${runId()}`);
	await page.clock.fastForward(500);
	await expect(
		dialog.getByText(message("chat_bot_selector_empty_state")),
	).toBeVisible();

	// Closing the dialog clears its search.
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await openBotSelector(page);
	await expect(search).toHaveValue("");
	await expect(
		dialog.getByRole("option", {
			name: message("chat_bot_selector_no_bot_title"),
		}),
	).toBeVisible();
});

test("chat: the composer bot selector pages, shows no stale rows while searching and reopens on its first page", async ({
	api,
	orgs,
	pageAs,
}) => {
	const fresh = await orgs.create(`E2E Bot Selector ${runId()}`);
	const member = api.as("member", fresh);
	const {
		data: { id: behaviourId },
	} = await member.block.create({
		type: "behaviour",
		name: `E2E Selector Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the chat start spec.",
		},
	});
	// One more than the selector's page.
	for (let index = 1; index <= 21; index++) {
		await member.bot.save({
			name: `E2E Paged Bot ${String(index).padStart(2, "0")}`,
			description: "Created by the chat start spec.",
			status: "ready",
			behaviourId,
			repositoryIds: [],
		});
	}
	await member.bot.save({
		name: "E2E Other Bot",
		description: "Created by the chat start spec.",
		status: "ready",
		behaviourId,
		repositoryIds: [],
	});
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member", fresh);
	await enterApp(page, fresh.slug);
	await open(page, "/app/chat");
	const main = page.getByRole("main");
	await expect(
		main.getByRole("link", {
			name: message("chat_start_action"),
		}),
	).toHaveCount(2);
	// The empty chat list's own action.
	await main
		.getByRole("link", {
			name: message("chat_start_action"),
		})
		.last()
		.click();
	await expect(page).toHaveURL(/\/app\/chat\/new$/);

	const { dialog, search } = await openBotSelector(page);
	const option = (name: string) =>
		dialog.getByRole("option", {
			name,
		});
	const position = (text: string) =>
		dialog
			.getByRole("navigation", {
				name: message("common_pagination_label"),
			})
			.getByText(text);
	await expect(position("1 / 2")).toBeVisible();

	const next = dialog.getByLabel(message("common_pagination_next_page_label"));
	await search.fill("E2E Paged Bot");
	await expect(option("E2E Paged Bot 01")).toBeVisible();
	await expect(option("E2E Other Bot")).toBeHidden();
	await expect(position("1 / 2")).toBeVisible();
	// The pager stays while the page loads, so the focus stays on Next.
	await next.focus();
	await page.keyboard.press("Enter");
	await expect(position("2 / 2")).toBeVisible();
	await expect(option("E2E Paged Bot 21")).toBeVisible();
	await expect(next).toBeFocused();

	let entered: (() => void) | undefined;
	const reached = new Promise<void>((resolve) => {
		entered = resolve;
	});
	let release: (() => void) | undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route(BOT_LIST, async (route) => {
		const request = route.request();
		if (`${request.url()} ${request.postData() ?? ""}`.includes("Other")) {
			entered?.();
			await held;
		}
		await route.fallback();
	});
	await search.fill("E2E Othe");
	await search.press("r");
	// After the last keystroke the debounce runs, and then the answer is held.
	await expect(option("E2E Paged Bot 21")).toBeHidden();
	await reached;
	await expect(option("E2E Paged Bot 21")).toBeHidden();
	await expect(option("E2E Other Bot")).toBeHidden();
	release?.();
	await expect(option("E2E Other Bot")).toBeVisible();
	await expect(option("E2E Paged Bot 21")).toBeHidden();
	await page.unroute(BOT_LIST);

	await search.clear();
	await expect(position("1 / 2")).toBeVisible();
	await expect(option(message("chat_bot_selector_no_bot_title"))).toBeVisible();
	await expect(option("E2E Paged Bot 01")).toBeVisible();

	await search.fill("E2E Paged Bot");
	await expect(option("E2E Paged Bot 01")).toBeVisible();
	await expect(option("E2E Other Bot")).toBeHidden();
	await next.click();
	await expect(position("2 / 2")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await openBotSelector(page);
	await expect(search).toHaveValue("");
	await expect(position("1 / 2")).toBeVisible();
	await expect(option(message("chat_bot_selector_no_bot_title"))).toBeVisible();
});
