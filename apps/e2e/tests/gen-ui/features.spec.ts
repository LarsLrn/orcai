import type { Page } from "@playwright/test";
import { rejection } from "../../fixtures/authorization";
import {
	chatName,
	createChat,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import {
	askEcho,
	completionBodies,
	createBot,
	createBotChat,
	GEN_UI,
	offeredTools,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const genUiSwitch = (page: Page) =>
	page.getByRole("switch", {
		name: message("feature_generative_ui_label"),
	});

/** The composer menu starts the chat tour unless the user has skipped it. */
const openChatSettings = async (page: Page) => {
	await page
		.getByRole("button", {
			name: message("chat_composer_more_actions_aria_label"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("chat_composer_settings_action"),
		})
		.click();

	return page.getByRole("dialog", {
		name: message("chat_settings_dialog_title"),
	});
};

const lastOfferedTools = (inference: Parameters<typeof completionBodies>[0]) =>
	offeredTools(completionBodies(inference).at(-1));

test("gen-ui: the bot editor saves Generative UI and its chats offer the checklist", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const bot = await createBot(member, {});
	// Created first, so the browser session's authorisation already sees it.
	const chatId = await createBotChat(member, model, bot.id);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/bots/${bot.id}/setup?step=1`);

	await expect(
		page.getByText(message("features_section_title"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(genUiSwitch(page)).not.toBeChecked();
	await genUiSwitch(page).click();
	await expect(genUiSwitch(page)).toBeChecked();
	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	await expect(
		page.getByText(message("authoring_wizard_saved_status")),
	).toBeVisible();

	await open(page, `/app/hub/bots/${bot.id}/setup?step=1`);
	await expect(genUiSwitch(page)).toBeChecked();

	await openChat(page, chatId);
	await askEcho(page, "Which tools do you have?");
	expect(lastOfferedTools(inference)).toContain("showChecklist");
});

test("gen-ui: a plain chat's switch saves at once and decides the tools offered", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "skipped",
	});
	const chatId = await createChat(member, model, chatName("Plain Features"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	await askEcho(page, "No features yet");
	expect(completionBodies(inference).at(-1)?.tools).toBeUndefined();

	const settings = await openChatSettings(page);
	await settings.getByRole("switch").click();
	await expect(genUiSwitch(page)).toBeChecked();
	await expect
		.poll(
			async () =>
				(
					await member.chat.find({
						id: chatId,
					})
				).data.config?.features,
		)
		.toEqual(GEN_UI);
	await page.keyboard.press("Escape");

	await askEcho(page, "Now with Generative UI");
	expect(lastOfferedTools(inference)).toContain("showChecklist");

	await openChatSettings(page);
	await genUiSwitch(page).click();
	await expect(genUiSwitch(page)).not.toBeChecked();
	await expect
		.poll(
			async () =>
				(
					await member.chat.find({
						id: chatId,
					})
				).data.config?.features,
		)
		.toEqual({});
	await page.keyboard.press("Escape");

	await askEcho(page, "Off again");
	expect(lastOfferedTools(inference)).not.toContain("showChecklist");
});

test("gen-ui: a bot-linked chat shows the bot's features read-only", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "skipped",
	});
	const bot = await createBot(member);
	const chatId = await createBotChat(member, model, bot.id);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const settings = await openChatSettings(page);
	await expect(genUiSwitch(page)).toBeChecked();
	await expect(genUiSwitch(page)).toHaveAttribute("aria-readonly", "true");
	await expect(
		settings.getByText(message("chat_settings_features_bot_managed_notice")),
	).toBeVisible();

	const rejected = await rejection(
		member.chat.update({
			id: chatId,
			config: {
				features: GEN_UI,
			},
		}),
	);
	expect(rejected.code).toBe("BAD_REQUEST");
	expect(rejected.data).toMatchObject({
		reason: "CHAT_BOT_FEATURES_IMMUTABLE",
	});
});
