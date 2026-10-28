import { randomUUID } from "node:crypto";
import type { ChatId, ModelId, ProviderId } from "@orcai/core";
import { expect, type Locator, type Page } from "@playwright/test";
import { createApiClient, createZedTokenStore } from "../api";
import { untilAllowed } from "../authorization";
import { baseURL } from "../env";
import type { Api, ApiClient } from "../index";
import {
	INFERENCE_MOCK_MODELS,
	type InferenceMock,
} from "../inference/fixture";
import { message } from "../messages";
import { open } from "../navigation";
import { runId } from "../organisation";

/** A name no other test uses, so a spec finds its own records. */
export const chatName = (label: string): string =>
	`E2E Chat ${label} ${runId()}`;

export type ChatModel = {
	providerId: ProviderId;
	modelId: ModelId;
};

/** The text an assistant stream carries, whatever else it streams. */
export const streamedText = async (
	stream: AsyncIterator<unknown>,
): Promise<string> => {
	let text = "";

	for (let step = await stream.next(); !step.done; step = await stream.next()) {
		const chunk = step.value;

		if (
			chunk !== null &&
			typeof chunk === "object" &&
			"type" in chunk &&
			chunk.type === "text-delta" &&
			"delta" in chunk &&
			typeof chunk.delta === "string"
		) {
			text += chunk.delta;
		}
	}

	return text;
};

/**
 * A provider on the mock with its chat model enabled for tools and a quota
 * pool covering every member, so members can chat through it.
 */
export const setUpChatModel = async (
	api: Api,
	inference: InferenceMock,
	quota: {
		meteringMode: "tokens" | "requests";
		budgetAmount: number;
	} = {
		meteringMode: "tokens",
		budgetAmount: 1_000_000,
	},
): Promise<ChatModel> => {
	const admin = api.as("admin");
	// The `org` fixture's admin joined through the sign-up hook, whose grant no
	// response announces. A refused create wrote nothing, so repeating is safe.
	const provider = await untilAllowed(() =>
		admin.provider.create({
			name: chatName("Provider"),
			description: "Mock OpenAI-compatible endpoint for the chat slice.",
			endpoint: inference.url,
			kind: "openai-compatible",
			meteringMode: quota.meteringMode,
			apiKey: "e2e-mock-key",
			enabled: true,
		}),
	);
	const providerId = provider.data.id;

	await admin.model.discover({
		providerId,
	});
	const models = await admin.model.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			providerId,
		},
	});
	const chatModel = models.data.find(
		(model) => model.providerModelId === INFERENCE_MOCK_MODELS.chat,
	);
	if (!chatModel) throw new Error("Missing mock chat model");
	await admin.model.update({
		id: chatModel.id,
		capabilities: [
			"text",
			"tool-calling",
		],
	});

	const groups = await admin.group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(group) => group.systemKey === "all_members",
	);
	if (!allMembers) throw new Error("Missing All Members group");

	await admin.quota.create({
		name: chatName("Pool"),
		providerId,
		periodType: "monthly",
		budgetAmount: quota.budgetAmount,
		groupIds: [
			allMembers.id,
		],
	});

	return {
		providerId,
		modelId: chatModel.id,
	};
};

/** A titled chat on the mock model, so no title generation runs. */
export const createChat = async (
	client: ApiClient,
	model: ChatModel,
	title: string,
): Promise<ChatId> => {
	const chat = await client.chat.create({
		title,
		config: model,
	});

	return chat.data.id;
};

/** A repository block of the client's own, attached to the chat. */
export const attachRepository = async (
	client: ApiClient,
	chatId: ChatId,
): Promise<void> => {
	const block = await client.block.create({
		type: "database",
		name: chatName("Repository"),
		status: "ready",
		assets: [],
		config: {
			minReferences: 1,
			maxReferences: 5,
			defaultReferences: 3,
		},
	});

	await client.chatBlock.attach({
		chatId,
		blockId: block.data.id,
	});
};

export type Turn = {
	question: string;
	reply: string;
};

/** Send one user message over the API and wait until both sides are stored. */
export const sendTurn = async ({
	client,
	inference,
	chatId,
	turn,
}: {
	client: ApiClient;
	inference: InferenceMock;
	chatId: ChatId;
	turn: Turn;
}): Promise<void> => {
	const before = await messageCount(client, chatId);

	inference.respondWith({
		text: turn.reply,
	});
	expect(await ask(client, chatId, turn.question)).toBe(turn.reply);
	await expect.poll(() => messageCount(client, chatId)).toBe(before + 2);
};

/** Send one user message over the API and return the streamed reply. */
export const ask = (
	client: ApiClient,
	chatId: ChatId,
	question: string,
): Promise<string> =>
	client.ai
		.chat({
			chatId,
			message: {
				id: randomUUID(),
				role: "user",
				parts: [
					{
						type: "text",
						text: question,
					},
				],
			},
		})
		.then(streamedText);

/** Messages stored in a chat, counted over every page. */
export const messageCount = async (
	client: ApiClient,
	chatId: ChatId,
	zedToken?: string,
): Promise<number> => {
	let count = 0;
	let before: number | undefined;

	for (;;) {
		const page = await client.chatMessage.list({
			chatId,
			before,
			limit: 100,
			zedToken,
		});
		count += page.data.length;
		before = page.data[0]?.position;
		if (!page.hasMore || before === undefined) return count;
	}
};

/** The chat completion requests the mock received, oldest first. */
export const completionRequests = (inference: InferenceMock) =>
	inference.requests.filter(
		(request) =>
			request.method === "POST" && request.path === "/v1/chat/completions",
	);

const textOf = (content: unknown): string => {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	return content
		.map((part: unknown) =>
			part !== null &&
			typeof part === "object" &&
			"text" in part &&
			typeof part.text === "string"
				? part.text
				: "",
		)
		.join("");
};

/** The user and assistant turns of a completion request, without the system prompt. */
export const conversationOf = (
	body: unknown,
): {
	role: string;
	text: string;
}[] => {
	if (
		body === null ||
		typeof body !== "object" ||
		!("messages" in body) ||
		!Array.isArray(body.messages)
	) {
		return [];
	}

	return body.messages.flatMap((entry: unknown) =>
		entry !== null &&
		typeof entry === "object" &&
		"role" in entry &&
		(entry.role === "user" || entry.role === "assistant") &&
		"content" in entry
			? [
					{
						role: entry.role,
						text: textOf(entry.content),
					},
				]
			: [],
	);
};

/** Mark the chat tour seen for the page's user, so its card does not cover the chat. */
const skipChatTour = async (page: Page): Promise<void> => {
	const cookies = await page.context().cookies();
	const client = createApiClient(
		baseURL(),
		cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
		createZedTokenStore(),
	);

	await client.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
};

/** Open a chat, its tour already seen, and wait for its composer. */
export const openChat = async (page: Page, chatId: ChatId): Promise<void> => {
	await skipChatTour(page);
	await open(page, `/app/chat/${chatId}`);
	await expect(composer(page)).toBeVisible();
};

/** The open chat's title, the header's last crumb, which opens the chat's menu. */
export const chatTitleMenu = (page: Page) =>
	page
		.getByRole("navigation", {
			name: message("breadcrumb_label"),
		})
		.getByRole("listitem")
		.last()
		.getByRole("button");

/** Open the chat's title menu and choose an item. */
export const chooseFromChatMenu = async (
	page: Page,
	item: string,
): Promise<void> => {
	await chatTitleMenu(page).click();
	await page
		.getByRole("menuitem", {
			name: message(item),
		})
		.click();
};

export const composer = (page: Page) =>
	page.getByRole("textbox", {
		name: message("chat_composer_aria_label"),
	});

/** Wait until the latest turn has finished streaming; its stream ends once the reply is stored. */
export const turnFinished = async (page: Page): Promise<void> => {
	await expect(
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_stop_aria_label"),
			exact: true,
		}),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
			exact: true,
		}),
	).toBeVisible();
};

/** Every "Branch from here" action, one per message, in chat order. */
export const branchActions = (page: Page) =>
	page.getByRole("button", {
		name: message("chat_message_branch_action"),
	});

/** A message's text in the conversation, not in the composer. */
export const messageText = (page: Page, text: string) =>
	page.getByRole("log").getByText(text, {
		exact: true,
	});

/** Where an element's top edge sits in the viewport. */
export const topOf = async (locator: Locator): Promise<number> => {
	const box = await locator.boundingBox();
	if (!box) throw new Error(`${String(locator)} is not rendered`);

	return box.y;
};
