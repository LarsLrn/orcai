import type { Page } from "@playwright/test";
import { expectForbidden, rejection } from "../../fixtures/authorization";
import {
	chatName,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import { submitForm } from "../../fixtures/forms";
import {
	ask,
	completionBodies,
	createBot,
	createBotChat,
	offeredTools,
	toolResults,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import { openGuarded } from "../../fixtures/orgs/navigation";
import {
	SEARCH_API_KEY,
	searchBodies,
	setUpSearchProvider,
} from "../../fixtures/web-search/web-search";

const WEB_SEARCH = {
	webSearch: {
		allowedDomains: [
			"docs.example.org",
		],
	},
};

// Specs here set the worker organisation's web search; later specs expect it off.
test.afterEach(async ({ api, org }) => {
	await api.as("admin").organization.update({
		id: org.id,
		webSearch: {
			mode: "off",
		},
	});
});

test("web-search: a bot answers with a cited page from the search provider", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	await setUpSearchProvider(api, inference, org.id);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "skipped",
	});
	const bot = await createBot(member, WEB_SEARCH);
	const chatId = await createBotChat(member, model, bot.id);

	inference.script(
		{
			toolCalls: [
				{
					name: "searchWeb",
					input: {
						query: "orca pods",
					},
				},
			],
		},
		{
			text: "Orcas live in pods, see [the guide](https://docs.example.org/search-result).",
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(
		page.getByText(message("chat_web_search_notice_off")),
	).toHaveCount(0);
	await ask(page, "How do orcas live?");
	await turnFinished(page);

	const [search] = searchBodies(inference);
	expect(search?.headers.authorization).toBe(`Bearer ${SEARCH_API_KEY}`);
	expect(search?.body).toMatchObject({
		query: "orca pods",
		max_results: 5,
		include_domains: [
			"docs.example.org",
		],
	});
	expect(offeredTools(completionBodies(inference)[0])).toContain("searchWeb");
	expect(JSON.stringify(toolResults(completionBodies(inference)[1]))).toContain(
		"https://docs.example.org/search-result",
	);

	const sources = page.getByRole("region", {
		name: message("chat_web_sources_label"),
	});
	await expect(
		sources.getByRole("link", {
			name: "Mock search result for orca pods",
		}),
	).toHaveAttribute("href", "https://docs.example.org/search-result");

	// The work log stays mounted while folded.
	await expect(
		page.getByText("Searched the web for “orca pods”, 1 page", {
			exact: true,
		}),
	).toBeAttached();
});

test("web-search: a bot with web search warns while the organisation's search is off and still answers", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "skipped",
	});
	const bot = await createBot(member, WEB_SEARCH);
	const chatId = await createBotChat(member, model, bot.id);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(
		page.getByRole("status").filter({
			hasText: message("chat_web_search_notice_off"),
		}),
	).toBeVisible();

	await ask(page, "Search anything");
	await expect(
		page
			.getByRole("log")
			.getByText("Mock inference reply to: Search anything", {
				exact: true,
			}),
	).toBeVisible();
	expect(offeredTools(completionBodies(inference).at(-1))).not.toContain(
		"searchWeb",
	);
	expect(searchBodies(inference)).toEqual([]);
});

test("web-search: a search provider has no models, meters requests and only admins choose it", async ({
	api,
	inference,
	org,
}) => {
	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const { data: search } = await admin.provider.create({
		name: chatName("Search"),
		description: "",
		endpoint: null,
		kind: "tavily",
		meteringMode: "requests",
		apiKey: SEARCH_API_KEY,
		enabled: true,
	});
	const reasonOf = async (call: Promise<unknown>) =>
		(
			(await rejection(call)).data as {
				reason?: string;
			}
		).reason;

	expect(
		await reasonOf(
			admin.model.create({
				providerId: search.id,
				providerModelId: "search-model",
				name: "Search model",
				description: "",
				isDeprecated: false,
				capabilities: [
					"text",
				],
			}),
		),
	).toBe("PROVIDER_PURPOSE_MISMATCH");
	expect(
		await reasonOf(
			admin.model.discover({
				providerId: search.id,
			}),
		),
	).toBe("PROVIDER_PURPOSE_MISMATCH");
	expect(
		await reasonOf(
			admin.provider.update({
				id: search.id,
				meteringMode: "tokens",
			}),
		),
	).toBe("PROVIDER_METERING_MODE_NOT_ALLOWED");
	expect(
		await reasonOf(
			admin.organization.update({
				id: org.id,
				webSearch: {
					mode: "provider",
					providerId: chat.providerId,
				},
			}),
		),
	).toBe("PROVIDER_PURPOSE_MISMATCH");
	await expectForbidden(
		api.as("manager").organization.update({
			id: org.id,
			webSearch: {
				mode: "native",
			},
		}),
	);
});

test("web-search: an admin chooses the search provider on the organisation page", async ({
	api,
	org,
	pageAs,
}) => {
	const admin = api.as("admin");
	const { data: search } = await admin.provider.create({
		name: chatName("Search"),
		description: "",
		endpoint: null,
		kind: "tavily",
		meteringMode: "requests",
		apiKey: SEARCH_API_KEY,
		enabled: true,
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);
	const picker = page.getByRole("combobox", {
		name: message("orgs_form_web_search_label"),
	});
	await expect(picker).toContainText(
		message("orgs_form_web_search_off_option"),
	);

	await submitForm(page, {
		fill: async () => {
			await picker.click();
			await page
				.getByRole("option", {
					name: message("orgs_form_web_search_provider_option", {
						name: search.name,
					}),
				})
				.click();
		},
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect
		.poll(
			async () =>
				(
					await admin.organization.find({
						id: org.id,
					})
				).data,
		)
		.toMatchObject({
			webSearchMode: "provider",
			webSearchProviderId: search.id,
		});
});

test("web-search: a search provider without a quota pool shows a warning that ends with a pool", async ({
	api,
	org,
	pageAs,
}) => {
	const admin = api.as("admin");
	const { data: search } = await admin.provider.create({
		name: chatName("Search"),
		description: "",
		endpoint: null,
		kind: "tavily",
		meteringMode: "requests",
		apiKey: SEARCH_API_KEY,
		enabled: true,
	});
	const notice = (page: Page) =>
		page.getByRole("alert").filter({
			hasText: message("providers_search_pool_notice_title"),
		});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);
	await expect(notice(page)).toHaveCount(0);
	await page
		.getByRole("combobox", {
			name: message("orgs_form_web_search_label"),
		})
		.click();
	await page
		.getByRole("option", {
			name: message("orgs_form_web_search_provider_option", {
				name: search.name,
			}),
		})
		.click();
	await expect(notice(page)).toBeVisible();
	await expect(
		notice(page).getByRole("link", {
			name: message("providers_search_pool_notice_action"),
		}),
	).toHaveAttribute("href", "/app/quotas/add");

	await openGuarded(page, `/app/providers/${search.id}`, search.name);
	await expect(notice(page)).toBeVisible();

	const allMembers = (
		await admin.group.list({
			pageIndex: 0,
			pageSize: 100,
		})
	).data.find((group) => group.systemKey === "all_members");
	if (!allMembers) throw new Error("Missing All Members group");
	await admin.quota.create({
		name: chatName("Search Pool"),
		providerId: search.id,
		periodType: "monthly",
		budgetAmount: 100,
		groupIds: [
			allMembers.id,
		],
	});
	await openGuarded(page, `/app/providers/${search.id}`, search.name);
	await expect(notice(page)).toHaveCount(0);
});
