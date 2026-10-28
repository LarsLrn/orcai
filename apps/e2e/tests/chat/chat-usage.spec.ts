import type { Page } from "@playwright/test";
import {
	chatName,
	completionRequests,
	composer,
	createChat,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const TURN = {
	question: "Name a primary colour.",
	reply: "Red is a primary colour.",
};

const usageButton = (page: Page) =>
	page.getByRole("button", {
		name: message("chat_usage_trigger_aria_label"),
	});

const submitButton = (page: Page) =>
	page.getByRole("button", {
		name: message("ai_elements_prompt_input_submit_aria_label"),
		exact: true,
	});

test("chat usage: the indicator shows the context and how much of the pool is used", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference, {
		meteringMode: "requests",
		budgetAmount: 4,
	});
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Usage"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: TURN,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await usageButton(page).click();

	await expect(
		page.getByText(message("chat_usage_context_title")),
	).toBeVisible();
	await expect(page.getByText(/^25% used · resets in /)).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("chat_usage_manage_pool_action"),
		}),
	).toHaveCount(0);
});

test("chat usage: a used-up pool blocks sending, with a notice below the composer", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference, {
		meteringMode: "requests",
		budgetAmount: 1,
	});
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Used up"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: TURN,
	});
	const requests = completionRequests(inference).length;

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const notice = page.getByRole("status").filter({
		hasText: message("chat_quota_exhausted_notice_title"),
	});
	await expect(notice).toBeVisible();
	await expect(notice).toContainText(/Resets in /);
	await composer(page).fill("One more question");
	await expect(submitButton(page)).toBeDisabled();

	await composer(page).press("Enter");
	await expect(composer(page)).toHaveValue("One more question");
	expect(completionRequests(inference)).toHaveLength(requests);
});
