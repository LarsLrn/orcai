import {
	chatName,
	composer,
	createChat,
	messageCount,
	messageText,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const REPLY = "Worth the wait.";

// Longer than the server's idle timeout, so only keep-alive traffic holds the stream open.
const SILENCE_MS = 12_000;

test("a turn survives a model that stays silent before answering", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.setTimeout(45_000);
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Silent Model"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script({
		text: REPLY,
		hold: "response",
	});
	await composer(page).fill("Take your time.");
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
			exact: true,
		})
		.click();
	await expect.poll(() => inference.held()).toBe(1);

	await new Promise((resolve) => setTimeout(resolve, SILENCE_MS));
	expect(inference.abandoned()).toBe(0);
	inference.release();

	await expect(messageText(page, REPLY)).toBeVisible();
	await turnFinished(page);
	await expect.poll(() => messageCount(member, chatId)).toBe(2);
});
