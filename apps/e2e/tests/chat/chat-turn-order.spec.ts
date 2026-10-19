import { randomUUID } from "node:crypto";
import type { ChatId } from "@orcai/core";
import {
	type ChatModel,
	chatName,
	composer,
	createChat,
	messageText,
	openChat,
	setUpChatModel,
	streamedText,
} from "../../fixtures/chat/chat";
import {
	type CompletionGate,
	startCompletionGate,
} from "../../fixtures/chat/completion-gate";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const REPLY = "Stored in order.";

let gate: CompletionGate;

test.beforeEach(async ({ inference }) => {
	gate = await startCompletionGate(inference.url);
	inference.respondWith({
		text: REPLY,
	});
});

test.afterEach(async () => {
	await gate.stop();
});

const setUp = async (
	api: Parameters<typeof setUpChatModel>[0],
	inference: Parameters<typeof setUpChatModel>[1],
): Promise<ChatModel> => setUpChatModel(api, inference, gate.url);

/** Every stored message as role and text, in position order. */
const storedTurns = async (client: ApiClient, chatId: ChatId) => {
	const page = await client.chatMessage.list({
		chatId,
		limit: 100,
	});

	return page.data.map((stored) => ({
		position: stored.position,
		role: stored.role,
		text: stored.parts
			.flatMap((part: unknown) =>
				part !== null &&
				typeof part === "object" &&
				"type" in part &&
				part.type === "text" &&
				"text" in part &&
				typeof part.text === "string"
					? [
							part.text,
						]
					: [],
			)
			.join(""),
	}));
};

const ask = (client: ApiClient, chatId: ChatId, question: string) =>
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

test("two turns finishing together both keep their replies", async ({
	api,
	inference,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Concurrent"));

	gate.close();
	const turns = Promise.all([
		ask(member, chatId, "First question?"),
		ask(member, chatId, "Second question?"),
	]);
	await expect.poll(() => gate.held()).toBe(2);
	gate.open();

	expect(await turns).toEqual([
		REPLY,
		REPLY,
	]);
	const stored = await storedTurns(member, chatId);
	expect(stored.map((turn) => turn.position)).toEqual([
		0,
		1,
		2,
		3,
	]);
	expect(stored.filter((turn) => turn.role === "assistant")).toHaveLength(2);
	expect(
		stored
			.filter((turn) => turn.role === "user")
			.map((turn) => turn.text)
			.sort(),
	).toEqual([
		"First question?",
		"Second question?",
	]);
});

test("the next turn can only start once the reply is stored", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Turn Order"));
	const submit = (page: Awaited<ReturnType<typeof pageAs>>) =>
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
		});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	gate.close();
	await composer(page).fill("Question A");
	await submit(page).click();
	await expect.poll(() => gate.held()).toBe(1);

	await composer(page).fill("Question B");
	await expect(
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_stop_aria_label"),
		}),
	).toBeVisible();
	await expect(submit(page)).toHaveCount(0);

	gate.open();
	await submit(page).click();
	await expect(messageText(page, "Question B")).toBeVisible();

	await expect
		.poll(async () =>
			(await storedTurns(member, chatId)).map(({ role, text }) => ({
				role,
				text,
			})),
		)
		.toEqual([
			{
				role: "user",
				text: "Question A",
			},
			{
				role: "assistant",
				text: REPLY,
			},
			{
				role: "user",
				text: "Question B",
			},
			{
				role: "assistant",
				text: REPLY,
			},
		]);
});
