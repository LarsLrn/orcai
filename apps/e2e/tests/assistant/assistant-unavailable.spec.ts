import {
	openAssistant,
	openConversation,
	reasonOf,
	setAssistantModel,
	setUpAssistantModel,
	startConversation,
	turnRefusal,
} from "../../fixtures/assistant/assistant";
import { composer, messageText, sendTurn } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

test("assistant: without a model an admin is pointed to the organisation page and a viewer to an admin", async ({
	api,
	org,
	pageAs,
}) => {
	await setAssistantModel(api.as("admin"), org, null);

	const admin = await pageAs("admin");
	await enterApp(admin, org.slug);
	await openAssistant(admin);
	await expect(
		admin.getByText(message("assistant_unavailable_title")),
	).toBeVisible();
	await expect(composer(admin)).toHaveCount(0);
	await expect(
		admin.getByRole("link", {
			name: message("readiness_open_checklist_action"),
		}),
	).toHaveAttribute("href", "/app/manage");

	const viewer = await pageAs("viewer");
	await enterApp(viewer, org.slug);
	await openAssistant(viewer);
	await expect(
		viewer.getByText(message("assistant_unavailable_description_member")),
	).toBeVisible();
	await expect(
		viewer.getByRole("link", {
			name: message("readiness_open_checklist_action"),
		}),
	).toHaveCount(0);
	await expect(composer(viewer)).toHaveCount(0);
});

test("assistant: a turn without a model is refused", async ({ api, org }) => {
	await setAssistantModel(api.as("admin"), org, null);
	const member = api.as("member");
	const chatId = await startConversation(member);

	expect(reasonOf(await turnRefusal(member, chatId))).toBe(
		"ASSISTANT_MODEL_NOT_CONFIGURED",
	);
});

test("assistant: an existing conversation keeps its transcript once the model is cleared", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startConversation(member);
	const turn = {
		question: "What is a bot?",
		reply: "A bot is a configured assistant.",
	};
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn,
	});
	await setAssistantModel(api.as("admin"), org, null);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);

	await expect(messageText(page, turn.question)).toBeVisible();
	await expect(messageText(page, turn.reply)).toBeVisible();
	await expect(
		page.getByText(message("assistant_unavailable_title")),
	).toBeVisible();
	await expect(composer(page)).toHaveCount(0);
});
