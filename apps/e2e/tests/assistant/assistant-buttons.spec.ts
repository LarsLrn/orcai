import type { Page } from "@playwright/test";
import {
	setAssistantModel,
	setUpAssistantModel,
} from "../../fixtures/assistant/assistant";
import { composer } from "../../fixtures/chat/chat";
import { createBot } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const askButton = (page: Page) =>
	page.getByRole("button", {
		name: message("assistant_ask_action"),
		exact: true,
	});

const openBotSetup = async (page: Page, botId: string): Promise<void> => {
	await open(page, `/app/hub/bots/${botId}/setup`);
	await expect(
		page.getByRole("heading", {
			name: message("bots_setup_page_title"),
		}),
	).toBeVisible();
};

const openGroups = async (page: Page): Promise<void> => {
	await open(page, "/app/groups");
	await expect(
		page.getByRole("heading", {
			name: message("groups_page_title"),
		}),
	).toBeVisible();
};

/**
 * The user menu names the organisation once the query the button reads from
 * has loaded, so the button's absence after it is settled.
 */
const expectNoAskButton = async (
	page: Page,
	orgName: string,
): Promise<void> => {
	await expect(
		page.getByRole("button", {
			name: orgName,
		}),
	).toBeVisible();
	await expect(askButton(page)).toHaveCount(0);
};

/** The button leads to a new conversation with the draft unsent and the param dropped. */
const expectDraft = async (page: Page, draft: string): Promise<void> => {
	await expect(
		page.getByRole("heading", {
			name: message("assistant_history_title"),
		}),
	).toBeVisible();
	await expect(page).toHaveURL(/\/app\/assistant\/?$/);
	await expect(composer(page)).toHaveValue(draft);
};

test("assistant: the bot editor's button opens the assistant with a setup draft", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const bot = await createBot(api.as("member"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openBotSetup(page, bot.id);
	await askButton(page).click();

	await expectDraft(
		page,
		message("assistant_ask_bot_setup_draft", {
			name: bot.name,
		}),
	);
});

test("assistant: the groups page's button opens the assistant with a groups draft", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGroups(page);
	await askButton(page).click();

	await expectDraft(page, message("assistant_ask_groups_draft"));
});

test("assistant: the contextual buttons are hidden without an assistant model", async ({
	api,
	org,
	pageAs,
}) => {
	await setAssistantModel(api.as("admin"), org, null);
	const bot = await createBot(api.as("admin"));

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openBotSetup(page, bot.id);
	await expectNoAskButton(page, org.name);

	await openGroups(page);
	await expectNoAskButton(page, org.name);
});
