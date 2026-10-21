import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { turnRequests } from "../../fixtures/assistant/assistant";
import { rejection } from "../../fixtures/authorization";
import {
	chatName,
	composer,
	createChat,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import {
	INFERENCE_MOCK_MODELS,
	type InferenceMock,
} from "../../fixtures/inference/server";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const REPLY = "Provider defaults apply.";

/** What a reply without max tokens asks for. */
const DEFAULT_MAX_TOKENS = {
	max_tokens: 16_384,
};

const GENERATION_KEYS = [
	"temperature",
	"top_p",
	"frequency_penalty",
	"presence_penalty",
	"max_tokens",
];

test.beforeEach(({ inference }) => {
	inference.reset();
	inference.respondWith({
		text: REPLY,
	});
});

/** The generation parameters the latest turn sent. */
const lastTurnParameters = (inference: InferenceMock) => {
	const body = turnRequests(inference).at(-1);
	if (!body) throw new Error("No streamed completion request");

	return Object.fromEntries(
		GENERATION_KEYS.filter((key) => key in body).map((key) => [
			key,
			body[key],
		]),
	);
};

const storedConfig = async (client: ApiClient, chatId: ChatId) =>
	(
		await client.chat.find({
			id: chatId,
		})
	).data.config;

/** Sends from the composer and waits for the reply, the `turn`-th of the chat. */
const send = async (page: Page, text: string, turn: number) => {
	await composer(page).fill(text);
	await composer(page).press("Enter");
	await expect(messageText(page, text)).toBeVisible();
	await expect(messageText(page, REPLY)).toHaveCount(turn);
};

const openSettings = async (page: Page) => {
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
	await page
		.getByRole("button", {
			name: message("chat_settings_advanced_title"),
		})
		.click();
};

const saveSettings = async (page: Page) => {
	await page
		.getByRole("button", {
			name: message("chat_settings_save_button"),
		})
		.click();
	await page.keyboard.press("Escape");
};

test("a chat started in the page leaves sampling to the provider and caps the output", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpChatModel(api, inference);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/chat/new");
	// The starter sends nothing until the default model is selected.
	await expect(
		page.getByRole("button", {
			name: INFERENCE_MOCK_MODELS.chat,
		}),
	).toBeVisible();
	await send(page, "Which defaults apply?", 1);

	expect(lastTurnParameters(inference)).toEqual(DEFAULT_MAX_TOKENS);
});

test("chat settings send only the parameters the member set", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Generation"));
	// The chat tour's card swallows the clicks on the composer's menu.
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	await openSettings(page);
	const temperature = page.getByRole("slider", {
		name: message("chat_settings_temperature_label"),
	});
	await expect(temperature).toBeVisible();
	await saveSettings(page);
	await expect
		.poll(async () => (await storedConfig(member, chatId))?.temperature)
		.toBeUndefined();
	await send(page, "Untouched settings", 1);
	expect(lastTurnParameters(inference)).toEqual(DEFAULT_MAX_TOKENS);

	await openSettings(page);
	await temperature.focus();
	await page.keyboard.press("ArrowRight");
	await saveSettings(page);
	await expect
		.poll(async () => (await storedConfig(member, chatId))?.temperature)
		.toBe(1.1);
	await send(page, "Warmer, please", 2);
	expect(lastTurnParameters(inference)).toEqual({
		...DEFAULT_MAX_TOKENS,
		temperature: 1.1,
	});

	await openSettings(page);
	await page
		.getByRole("button", {
			name: message("forms_slider_field_clear_aria_label", {
				label: message("chat_settings_temperature_label"),
			}),
		})
		.click();
	await saveSettings(page);
	await expect
		.poll(async () => (await storedConfig(member, chatId))?.temperature)
		.toBeUndefined();
	await send(page, "Back to the default", 3);
	expect(lastTurnParameters(inference)).toEqual(DEFAULT_MAX_TOKENS);
});

test("max tokens stay within the model's max output", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const admin = api.as("admin");
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Max output"));
	await admin.model.update({
		id: model.modelId,
		maxOutputTokens: 1_000,
	});

	const rejected = await rejection(
		member.chat.update({
			id: chatId,
			config: {
				maxTokens: 2_000,
			},
		}),
	);
	expect(rejected.code).toBe("BAD_REQUEST");
	expect(rejected.data).toMatchObject({
		reason: "CHAT_MAX_TOKENS_EXCEEDS_MODEL",
		params: {
			maxOutputTokens: 1_000,
		},
	});

	await member.chat.update({
		id: chatId,
		config: {
			maxTokens: 800,
		},
	});
	// A later edit of the model lowers what the chat may ask for.
	await admin.model.update({
		id: model.modelId,
		maxOutputTokens: 500,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await send(page, "Keep it short", 1);

	expect(lastTurnParameters(inference)).toEqual({
		max_tokens: 500,
	});
	// The mock reports a context window, so the reply shows how full it is.
	await expect(
		page.getByRole("img", {
			name: message("ai_elements_context_usage_aria_label"),
		}),
	).toBeVisible();
});
