import type { BotId, ChatId } from "@orcai/core";
import { expect, type Page } from "@playwright/test";
import {
	type ChatModel,
	chatName,
	composer,
	messageText,
	turnFinished,
} from "../chat/chat";
import type { ApiClient } from "../index";
import { message } from "../messages";

export const GEN_UI = {
	generativeUi: {},
};

/** A plain chat on the mock model with Generative UI on. */
export const createGenUiChat = async (
	client: ApiClient,
	model: ChatModel,
	title: string,
): Promise<ChatId> => {
	const chat = await client.chat.create({
		title,
		config: {
			...model,
			features: GEN_UI,
		},
	});

	return chat.data.id;
};

/** A draft bot with a behaviour and the given features. */
export const createBot = async (
	client: ApiClient,
	features: Record<string, unknown> = GEN_UI,
): Promise<{
	id: BotId;
	name: string;
}> => {
	const behaviour = await client.block.create({
		type: "behaviour",
		name: chatName("Behaviour"),
		status: "ready",
		config: {
			systemPrompt: "Created by the gen-ui slice.",
		},
	});
	const bot = await client.bot.save({
		name: chatName("Bot"),
		description: "Created by the gen-ui slice.",
		status: "draft",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
		features,
	});

	return {
		id: bot.data.id,
		name: bot.data.name,
	};
};

/** A chat linked to a bot, titled so no title generation runs. */
export const createBotChat = async (
	client: ApiClient,
	model: ChatModel,
	botId: BotId,
): Promise<ChatId> => {
	const chat = await client.chat.create({
		botId,
		title: chatName("Bot Chat"),
		config: model,
	});

	return chat.data.id;
};

/** Type a question and send it from the composer. */
export const ask = async (page: Page, question: string): Promise<void> => {
	await composer(page).fill(question);
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
			exact: true,
		})
		.click();
};

/** Send a question and wait for the mock's echo of it. */
export const askEcho = async (page: Page, question: string): Promise<void> => {
	await ask(page, question);
	await expect(
		messageText(page, `Mock inference reply to: ${question}`),
	).toBeVisible();
	await turnFinished(page);
};
