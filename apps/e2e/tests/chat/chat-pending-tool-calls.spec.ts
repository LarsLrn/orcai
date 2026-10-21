import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import {
	ask,
	attachRepository,
	chatName,
	completionRequests,
	composer,
	createChat,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const CALL_ID = "call_e2e_dangling";
const INTERRUPTED =
	"Not completed: the turn was interrupted. If the call changes something, it may have been applied; check before retrying.";

/** A chat whose last reply holds a search call that never got a result. */
const chatWithDanglingCall = async (
	client: ApiClient,
	chatId: ChatId,
	inference: InferenceMock,
) => {
	await attachRepository(client, chatId);
	inference.script({
		text: "Let me search.",
		toolCalls: [
			{
				name: "searchKnowledgeBase",
				input: {
					query: "pending calls",
				},
				id: CALL_ID,
			},
		],
		finishReason: "length",
	});
	await ask(client, chatId, "Search the repository.");
};

const storedCall = async (client: ApiClient, chatId: ChatId) => {
	const page = await client.chatMessage.list({
		chatId,
		limit: 100,
	});

	return page.data
		.flatMap((stored) => stored.parts)
		.find(
			(part: unknown) =>
				part !== null &&
				typeof part === "object" &&
				"toolCallId" in part &&
				part.toolCallId === CALL_ID,
		);
};

/** The OpenAI-format messages of the latest completion request. */
const lastPrompt = (inference: InferenceMock) => {
	const body = completionRequests(inference).at(-1)?.body as {
		messages: Record<string, unknown>[];
	};

	return body.messages;
};

const interruptedBadge = async (page: Page) => {
	await page
		.getByRole("log")
		.getByRole("button", {
			name: /^\d+ steps?$/,
		})
		.first()
		.click();

	return page
		.getByRole("log")
		.getByText(message("chat_work_log_tool_status_interrupted"), {
			exact: true,
		});
};

test("a reply with a call left without a result does not block the next message", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Dangling Call"));
	await chatWithDanglingCall(member, chatId, inference);

	expect(await storedCall(member, chatId)).toMatchObject({
		state: "input-available",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(await interruptedBadge(page)).toBeVisible();

	await composer(page).fill("Try again.");
	await composer(page).press("Enter");
	await expect(
		messageText(page, "Mock inference reply to: Try again."),
	).toBeVisible();
	await expect(
		page
			.getByRole("log")
			.getByText(message("chat_work_log_tool_status_interrupted"), {
				exact: true,
			}),
	).toBeVisible();

	const prompt = lastPrompt(inference);
	expect(prompt).toContainEqual(
		expect.objectContaining({
			role: "assistant",
			tool_calls: [
				expect.objectContaining({
					id: CALL_ID,
				}),
			],
		}),
	);
	expect(prompt).toContainEqual(
		expect.objectContaining({
			role: "tool",
			tool_call_id: CALL_ID,
			content: INTERRUPTED,
		}),
	);
	expect(await storedCall(member, chatId)).toMatchObject({
		state: "output-error",
		errorText: INTERRUPTED,
	});

	await page.reload();
	await expect(composer(page)).toBeVisible();
	await expect(await interruptedBadge(page)).toBeVisible();
});

test("a chat already stuck behind a dangling call answers again", async ({
	api,
	inference,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Stuck Chat"));
	await chatWithDanglingCall(member, chatId, inference);
	inference.failNext({
		status: 400,
	});
	expect(await ask(member, chatId, "A question whose turn failed.")).toBe("");

	expect(await ask(member, chatId, "Are you there?")).toBe(
		"Mock inference reply to: Are you there?",
	);
	expect(await storedCall(member, chatId)).toMatchObject({
		state: "output-error",
		errorText: INTERRUPTED,
	});
});
