import {
	chatName,
	completionRequests,
	composer,
	conversationOf,
	createChat,
	messageCount,
	messageText,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

test("a message sent in the page reaches the model with the stored history", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Send"));
	const first = {
		question: "Which colour is the sky?",
		reply: "The sky is blue.",
	};
	const second = {
		question: "And at sunset?",
		reply: "Orange and red at sunset.",
	};

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: first,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(messageText(page, first.reply)).toBeVisible();

	inference.respondWith({
		text: second.reply,
	});
	await composer(page).fill(second.question);
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
		})
		.click();

	await expect(messageText(page, second.reply)).toBeVisible();
	await expect(composer(page)).toHaveValue("");
	expect(conversationOf(completionRequests(inference).at(-1)?.body)).toEqual([
		{
			role: "user",
			text: first.question,
		},
		{
			role: "assistant",
			text: first.reply,
		},
		{
			role: "user",
			text: second.question,
		},
	]);

	await expect.poll(() => messageCount(member, chatId)).toBe(4);
	await page.reload();
	await expect(messageText(page, second.question)).toBeVisible();
	await expect(messageText(page, second.reply)).toBeVisible();
});
