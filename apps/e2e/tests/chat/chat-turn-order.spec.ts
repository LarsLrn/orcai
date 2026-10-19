import { randomUUID } from "node:crypto";
import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import {
	type ChatModel,
	chatName,
	completionRequests,
	composer,
	conversationOf,
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

const submitButton = (page: Page) =>
	page.getByRole("button", {
		name: message("ai_elements_prompt_input_submit_aria_label"),
		exact: true,
	});

const stopButton = (page: Page) =>
	page.getByRole("button", {
		name: message("ai_elements_prompt_input_stop_aria_label"),
		exact: true,
	});

/** One copy action per rendered message. */
const copyActions = (page: Page) =>
	page.getByRole("log").getByRole("button", {
		name: message("chat_message_copy_label"),
		exact: true,
	});

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

test("typing works while a turn runs, but sending waits for the stored reply", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Turn Order"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	gate.close();
	await composer(page).fill("Question A");
	await submitButton(page).click();
	await expect.poll(() => gate.held()).toBe(1);

	await composer(page).fill("Question B");
	await composer(page).press("Enter");
	await expect(composer(page)).toHaveValue("Question B");
	await expect(stopButton(page)).toBeVisible();
	await expect(submitButton(page)).toHaveCount(0);
	expect(gate.held()).toBe(1);
	await expect(copyActions(page)).toHaveCount(1);

	gate.open();
	await submitButton(page).click();
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

test("a message sent straight after Stop follows the stopped reply and sees it", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Stopped Turn"));
	const longReply = Array.from(
		{
			length: 400,
		},
		(_, index) => `word${index}`,
	).join(" ");

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	// Hold the page's check for the stored reply, so the wait after Stop is observable.
	let releaseCheck: () => void = () => undefined;
	const checkHeld = new Promise<void>((resolve) => {
		releaseCheck = resolve;
	});
	let checks = 0;
	await page.route("**/api/rpc/chatMessage/find", async (route) => {
		checks += 1;
		await checkHeld;
		await route.continue();
	});

	inference.respondWith({
		text: longReply,
	});
	await composer(page).fill("Question A");
	await submitButton(page).click();
	await expect(page.getByRole("log").getByText(/word5\b/)).toBeVisible();
	await stopButton(page).click();

	inference.respondWith({
		text: REPLY,
	});
	await expect.poll(() => checks).toBe(1);
	await composer(page).fill("Question B");
	await composer(page).press("Enter");
	await expect(composer(page)).toHaveValue("Question B");
	await expect(stopButton(page)).toBeDisabled();
	await expect(submitButton(page)).toHaveCount(0);

	releaseCheck();
	await submitButton(page).click();
	await expect(messageText(page, REPLY)).toBeVisible();

	const stored = await storedTurns(member, chatId);
	const partial = stored[1]?.text ?? "";
	expect(stored.map(({ role }) => role)).toEqual([
		"user",
		"assistant",
		"user",
		"assistant",
	]);
	expect(stored.map(({ text }) => text)).toEqual([
		"Question A",
		partial,
		"Question B",
		REPLY,
	]);
	expect(partial).toMatch(/^word0 word1 word2 word3 word4 word5\b/);
	expect(partial.length).toBeLessThan(longReply.length);

	const questionB = completionRequests(inference).at(-1);
	expect(conversationOf(questionB?.body)).toEqual([
		{
			role: "user",
			text: "Question A",
		},
		{
			role: "assistant",
			text: partial,
		},
		{
			role: "user",
			text: "Question B",
		},
	]);
});

test("Stop aborts the model call the turn is waiting on", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Aborted Turn"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	gate.close();
	await composer(page).fill("Question A");
	await submitButton(page).click();
	await expect.poll(() => gate.held()).toBe(1);
	await stopButton(page).click();

	await expect.poll(() => gate.abandoned()).toBe(1);
	await expect(submitButton(page)).toBeVisible();
	await expect
		.poll(async () =>
			(await storedTurns(member, chatId)).map(({ role }) => role),
		)
		.toEqual([
			"user",
		]);
});

test("a reply still being written is not shown as an empty message", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUp(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Reserved Reply"));

	gate.close();
	const turn = ask(member, chatId, "Question A");
	await expect.poll(() => gate.held()).toBe(1);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(messageText(page, "Question A")).toBeVisible();
	await expect(copyActions(page)).toHaveCount(1);
	expect(await storedTurns(member, chatId)).toEqual([
		{
			position: 0,
			role: "user",
			text: "Question A",
		},
	]);

	gate.open();
	expect(await turn).toBe(REPLY);
	expect(await storedTurns(member, chatId)).toEqual([
		{
			position: 0,
			role: "user",
			text: "Question A",
		},
		{
			position: 1,
			role: "assistant",
			text: REPLY,
		},
	]);
});
