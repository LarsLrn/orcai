import type { Page } from "@playwright/test";
import {
	actStep,
	cardButton,
	confirmationCard,
	loadTools,
} from "../../fixtures/assistant/approval";
import {
	conversationLog,
	historyEntry,
	quoted,
	setUpAssistantModel,
	startTitledConversation,
} from "../../fixtures/assistant/assistant";
import { turnFinished } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import type { Api } from "../../fixtures/index";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId, type WorkerOrganisation } from "../../fixtures/organisation";

const DONE = "The bot is in your Library now.";

/** The `api` fixture acting in another of the worker's organisations. */
const apiIn = (api: Api, organisation: WorkerOrganisation): Api => ({
	as: (role) => api.as(role, organisation),
	asWellKnownAdmin: api.asWellKnownAdmin,
});

const sidebarLink = (page: Page, name: string) =>
	page.getByRole("link", {
		name,
		exact: true,
	});

test("assistant: adding from the Catalogue refreshes the Library and Catalogue pages the tab already loaded", async ({
	api,
	inference,
	orgs,
	pageAs,
}) => {
	test.slow();

	const id = runId();
	const author = api.as("member");
	const behaviour = await author.block.create({
		type: "behaviour",
		name: `E2E Refresh Behaviour ${id}`,
		status: "ready",
		config: {
			systemPrompt: "Answer like a writing tutor.",
		},
	});
	const { data: bot } = await author.bot.save({
		name: `E2E Refresh Bot ${id}`,
		description: "Listed by the assistant refresh spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	await author.resource.setVisibility({
		resourceType: "bot",
		resourceId: bot.id,
		visibility: "public",
		listBlockIds: [
			behaviour.data.id,
		],
	});

	// A fresh organisation, whose Library holds only what the turn adds.
	const other = await orgs.create(`E2E Assistant Refresh ${id}`);
	const otherApi = apiIn(api, other);
	await setUpAssistantModel(otherApi, other, inference);
	const admin = otherApi.as("admin");
	const chatId = await startTitledConversation(admin, inference);
	const { data: chat } = await admin.chat.find({
		id: chatId,
	});
	inference.script(
		loadTools("bots"),
		actStep("I will add the bot.", {
			name: "addFromCatalogue",
			input: {
				entry: {
					targetType: "bot",
					targetId: bot.id,
				},
			},
		}),
		{
			text: DONE,
		},
	);

	// The tab loads the entry and the Library, then moves on without reloading.
	const page = await pageAs("admin", other);
	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/bots/${bot.id}`);
	await expect(
		page.getByRole("button", {
			name: message("catalogue_add_action", {
				organisation: other.name,
			}),
		}),
	).toBeVisible();
	await sidebarLink(page, message("sidebar_menu_library_item")).click();
	await expect(page.getByText(message("library_empty_title"))).toBeVisible();
	await sidebarLink(page, message("assistant_name")).click();
	await historyEntry(page, chat.title ?? "").click();
	await expect(
		conversationLog(page).getByText(chat.title ?? "", {
			exact: true,
		}),
	).toBeVisible();
	await turnFinished(page);

	await ask(page, "Add the tutor bot from the Catalogue");
	const card = confirmationCard(
		page,
		message("assistant_tool_add_from_catalogue_summary", {
			name: quoted(bot.name),
		}),
	);
	await cardButton(card, message("common_add_button")).click();
	await expect(page.getByText(DONE)).toBeVisible();
	await turnFinished(page);

	// Back through the tab's history, each page shows what the turn changed.
	await page.goBack();
	await page.goBack();
	await expect(page).toHaveURL(/\/app\/library$/);
	await expect(
		page.getByRole("link", {
			name: bot.name,
		}),
	).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/app/catalogue/bots/${bot.id}$`));
	await expect(
		page.getByText(
			message("catalogue_added_label", {
				organisation: other.name,
			}),
		),
	).toBeVisible();
});
