import type { ChatId } from "@orcai/core";
import {
	branchActions,
	chatName,
	completionRequests,
	composer,
	conversationOf,
	createChat,
	messageText,
	openChat,
	sendTurn,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

/** Leaves 6 000 tokens to the prompt, after half the window for the reply. */
const CONTEXT_WINDOW = 12_000;
const SUMMARY = "The member asked for two primary colours: red and blue.";
const SUMMARY_MESSAGE = `Summary of the earlier conversation:\n\n${SUMMARY}`;
/** Over 80% of the prompt's room on its own, but within it. */
const LONG_QUESTION = `${"Consider this sentence once more. ".repeat(640)}Which colour is left?`;
const ANSWER = "Yellow is the third primary colour.";

test("a long chat is summarized, marked with a divider, and keeps answering, also in a branch", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	inference.reset();
	const model = await setUpChatModel(api, inference);
	await api.as("admin").model.update({
		id: model.modelId,
		contextWindow: CONTEXT_WINDOW,
	});
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
	const title = chatName("Compaction");
	const chatId = await createChat(member, model, title);
	for (const turn of [
		{
			question: "Name a primary colour.",
			reply: "Red is a primary colour.",
		},
		{
			question: "Name another one.",
			reply: "Blue is another.",
		},
	]) {
		await sendTurn({
			client: member,
			inference,
			chatId,
			turn,
		});
	}

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	inference.script(
		{
			text: SUMMARY,
			hold: "response",
		},
		{
			text: ANSWER,
		},
	);
	await composer(page).fill(LONG_QUESTION);
	await composer(page).press("Enter");
	await expect(
		page.getByRole("status").filter({
			hasText: message("chat_work_log_compacting"),
		}),
	).toHaveCount(1);
	await expect.poll(() => inference.held()).toBe(1);
	inference.release();
	await expect(messageText(page, ANSWER)).toBeVisible();
	const divider = page
		.getByRole("log")
		.getByText(message("chat_message_compacted"), {
			exact: true,
		});
	await expect(divider).toBeVisible();

	const [summaryRequest, answerRequest] =
		completionRequests(inference).slice(-2);
	// The summary is its own call over the history as text.
	expect(summaryRequest?.body).not.toHaveProperty("stream", true);
	expect(JSON.stringify(summaryRequest?.body)).toContain(
		"Name a primary colour.",
	);
	expect(conversationOf(answerRequest?.body)).toEqual([
		{
			role: "user",
			text: SUMMARY_MESSAGE,
		},
		{
			role: "user",
			text: LONG_QUESTION,
		},
	]);

	await turnFinished(page);
	await page.reload();
	await expect(messageText(page, ANSWER)).toBeVisible();
	await expect(divider).toBeVisible();
	await expect(messageText(page, SUMMARY)).toHaveCount(0);
	await expect(messageText(page, ANSWER)).toBeVisible();

	// A branch copies the summary with the reply that holds it.
	await branchActions(page).last().click();
	await expect(page).not.toHaveURL(new RegExp(`/app/chat/${chatId}`));
	await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]{36}/);
	const branchId = new URL(page.url()).pathname.split("/").at(-1) as ChatId;
	expect(branchId).not.toBe(chatId);
	// The parent's page stays mounted for a moment after the URL moves.
	await expect(
		page.getByRole("link", {
			name: message("chat_branched_from_link", {
				title,
			}),
		}),
	).toBeVisible();
	await expect(messageText(page, ANSWER)).toBeVisible();
	await expect(divider).toBeVisible();
	inference.respondWith({
		text: "Green is not a primary colour.",
	});
	await composer(page).fill("And green?");
	await composer(page).press("Enter");
	await expect(messageText(page, "And green?")).toBeVisible();
	await expect(
		messageText(page, "Green is not a primary colour."),
	).toBeVisible();

	expect(
		conversationOf(completionRequests(inference).at(-1)?.body).map(
			({ text }) => text,
		),
	).toEqual([
		SUMMARY_MESSAGE,
		LONG_QUESTION,
		ANSWER,
		"And green?",
	]);
});
