import type { Route } from "@playwright/test";
import {
	branchActions,
	chatName,
	createChat,
	messageText,
	openChat,
	sendTurn,
	setUpChatModel,
	topOf,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const TURNS = 12;
const PAGE_SIZE = 20;

const turn = (index: number) => {
	const label = String(index + 1).padStart(2, "0");

	return {
		question: `Paging question ${label}`,
		reply: `Paging answer ${label}. It runs long enough to wrap onto a second line, so twenty messages are taller than any screen the suite uses and the conversation has to scroll.`,
	};
};

test("a long chat opens on its newest page and loads older ones in place on scroll", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.setTimeout(90_000);

	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Paging"));

	for (let index = 0; index < TURNS; index += 1) {
		await sendTurn({
			client: member,
			inference,
			chatId,
			turn: turn(index),
		});
	}

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const oldestLoaded = messageText(page, turn(TURNS - PAGE_SIZE / 2).question);
	// Scrolled to the newest message once the conversation has hydrated, which can trail the document's marker.
	await expect(messageText(page, turn(TURNS - 1).reply)).toBeInViewport();
	await expect(oldestLoaded).toBeAttached();
	await expect(branchActions(page)).toHaveCount(PAGE_SIZE);
	await expect(messageText(page, turn(0).question)).toHaveCount(0);

	// Hold the older page until the reader's position before it is measured.
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/chatMessage/list**", async (route: Route) => {
		await held;
		await route.continue();
	});

	await oldestLoaded.hover();
	await page.mouse.wheel(0, -20_000);
	await expect(
		page.getByRole("status").filter({
			hasText: message("chat_earlier_messages_loading"),
		}),
	).toBeVisible();
	const topBefore = await topOf(oldestLoaded);

	release();
	await expect(branchActions(page)).toHaveCount(TURNS * 2);
	expect(Math.abs((await topOf(oldestLoaded)) - topBefore)).toBeLessThan(4);

	await page.mouse.wheel(0, -20_000);
	await expect(messageText(page, turn(0).question)).toBeVisible();
	await expect(
		page.getByText(message("chat_earlier_messages_loading")),
	).toHaveCount(0);
});
