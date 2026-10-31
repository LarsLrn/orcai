import {
	chatName,
	createChat,
	messageText,
	sendTurn,
	setUpChatModel,
	skipChatTour,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const TURNS = 12;

test("the chat search finds a message and opens the chat on it", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.setTimeout(90_000);

	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const title = chatName("Search");
	const chatId = await createChat(member, model, title);
	const word = `quokka${runId()}`;
	const question = `Where do ${word} live?`;

	// The hit is the oldest message, well before the newest page.
	for (let index = 0; index < TURNS; index += 1) {
		await sendTurn({
			client: member,
			inference,
			chatId,
			turn: {
				question: index === 0 ? question : `Filler question ${index}`,
				reply: `Filler answer ${index}. It runs long enough to wrap onto a second line, so the conversation has to scroll.`,
			},
		});
	}

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await skipChatTour(page);
	await open(page, "/app/chat");
	await page
		.getByPlaceholder(message("chat_list_search_placeholder"))
		.fill(word.slice(0, -2));

	const row = page.getByRole("row").filter({
		hasText: title,
	});
	await expect(row.locator("mark")).toHaveText(word);
	await row
		.getByRole("link", {
			name: title,
		})
		.click();

	const hit = messageText(page, question);
	await expect(hit).toBeInViewport();
	const highlighted = page.locator("[data-highlighted]");
	await expect(highlighted).toContainText(question);
	await expect(highlighted).toHaveCount(0);
});
