import { randomUUID } from "node:crypto";
import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import {
	offeredToolsOf,
	openConversation,
	setUpAssistantModel,
	startConversation,
	startTitledConversation,
	systemPromptOf,
	toolResultsOf,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import {
	chatName,
	composer,
	createChat,
	sendTurn,
	setUpChatModel,
	streamedText,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const BOTS_PATH = "/docs/using-orcai/bots";
// sourceRef("docs", BOTS_PATH), which the model reads beside the page.
const BOTS_REF = "do8r8j2";
const docsUrl = (process.env.WEB_URL ?? "").replace(/\/$/, "");
const docsFetchUrl = (process.env.WEB_INTERNAL_URL ?? "").replace(/\/$/, "");

/** What the docs site the app reads serves at a path, so assertions follow the docs. */
const servedDocs = async (path: string): Promise<string> => {
	const response = await fetch(`${docsFetchUrl}${path}`);
	expect(response.status).toBe(200);

	return await response.text();
};

/** OrcAI's confirmation before a link in an answer leaves the app. */
const linkConfirmation = (page: Page) =>
	page.getByRole("alertdialog", {
		name: message("chat_link_confirm_title"),
	});

const submit = (page: Page) =>
	page.getByRole("button", {
		name: message("ai_elements_prompt_input_submit_aria_label"),
	});

const ask = async (
	client: ApiClient,
	chatId: ChatId,
	question: string,
): Promise<string> =>
	await streamedText(
		await client.ai.chat({
			chatId,
			message: {
				id: randomUUID(),
				role: "user",
				parts: [
					{
						type: "text",
						text: question,
					},
				],
			},
		}),
	);

test("assistant: a member's question is answered from the docs with an app link and a docs citation, also after a reload", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const chatId = await startTitledConversation(api.as("member"), inference);
	const answer = "Bots are made in the Library.";

	inference.script(
		{
			toolCalls: [
				{
					name: "readDocs",
					input: {},
				},
			],
		},
		{
			toolCalls: [
				{
					name: "readDocs",
					input: {
						path: BOTS_PATH,
					},
				},
			],
		},
		{
			text: `<cite ref=${BOTS_REF}>${answer}</cite> Open [Bots](/app/library/bots) or [elsewhere](https://example.org/).`,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await composer(page).fill("How do I make a bot?");
	await submit(page).click();

	const log = page.getByRole("log");
	await expect(log.getByText(answer)).toBeVisible();

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(3);
	expect(offeredToolsOf(requests[0])).toContain("readDocs");
	const index = await servedDocs("/llms.txt");
	const botsPage = await servedDocs(`${BOTS_PATH}.md`);
	const botsTitle = /^# (.+) \(/.exec(botsPage)?.[1] ?? "";
	// The index lists pages without refs; a page arrives in a docs-page tag with its ref.
	expect(toolResultsOf(requests[1])).toEqual([
		index,
	]);
	expect(toolResultsOf(requests[2])).toContain(
		`<docs-page ref=${BOTS_REF} title="${botsTitle}" path="${BOTS_PATH}">\n${botsPage}\n</docs-page>`,
	);

	await log
		.getByRole("button", {
			name: /2 steps/,
		})
		.click();
	await expect(
		log.getByText(message("chat_work_log_tool_read_docs_index"), {
			exact: true,
		}),
	).toBeVisible();
	const docsLink = log.getByRole("link", {
		name: botsTitle,
		exact: true,
	});
	await expect(docsLink).toHaveAttribute("href", `${docsUrl}${BOTS_PATH}`);
	await expect(docsLink).toHaveAttribute("target", "_blank");

	const opened = page.context().waitForEvent("page");
	await log
		.getByText("Bots", {
			exact: true,
		})
		.click();
	const appPage = await opened;
	await expect(appPage).toHaveURL(/\/app\/library\/bots$/);
	await expect(linkConfirmation(page)).toHaveCount(0);
	await appPage.close();

	await log
		.getByText("elsewhere", {
			exact: true,
		})
		.click();
	await expect(linkConfirmation(page)).toBeVisible();
	await linkConfirmation(page)
		.getByRole("button", {
			name: message("common_cancel_button"),
		})
		.click();
	await expect(linkConfirmation(page)).toHaveCount(0);

	// The docs citation opens its page, a trusted docs link, without asking.
	const citation = log.getByRole("button", {
		name: message("ai_elements_cite_docs_aria_label", {
			title: botsTitle,
		}),
		exact: true,
	});
	await expect(citation).toHaveText(botsTitle);
	await citation.click();
	const card = page.getByRole("dialog");
	await expect(
		card.getByText(message("ai_elements_cite_docs_source")),
	).toBeVisible();
	const docsOpened = page.context().waitForEvent("page");
	await card
		.getByRole("button", {
			name: message("ai_elements_cite_open_page_action"),
		})
		.click();
	const docsPage = await docsOpened;
	await expect(docsPage).toHaveURL(`${docsUrl}${BOTS_PATH}`);
	await expect(linkConfirmation(page)).toHaveCount(0);
	await docsPage.close();

	await page.reload();
	await expect(citation).toHaveText(botsTitle);
});

test("assistant: the user's identity and role section end the system prompt after a stable part shared by every role", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);

	const promptOf = async (role: "admin" | "viewer") => {
		inference.reset();
		const client = api.as(role);
		const chatId = await startConversation(client);
		inference.respondWith({
			text: `Hello, ${role}.`,
		});

		expect(await ask(client, chatId, "Who am I?")).toBe(`Hello, ${role}.`);

		const [request] = turnRequests(inference);
		const prompt = systemPromptOf(request);
		const at = prompt.lastIndexOf("\n\nCurrent user:\n");
		expect(at).toBeGreaterThan(0);
		// The tool groups, offered by role, are the first variable section.
		const groups = prompt.indexOf("\n\nTool groups:\n");
		const variable = groups === -1 ? at : groups;
		expect(variable).toBeLessThanOrEqual(at);

		return {
			stable: prompt.slice(0, variable),
			groups: groups === -1 ? [] : prompt.slice(groups + 2, at).split("\n"),
			section: prompt.slice(at + 2).split("\n"),
		};
	};

	const viewer = await promptOf("viewer");
	const admin = await promptOf("admin");

	expect(viewer.stable).toBe(admin.stable);
	expect(viewer.groups).toEqual([]);
	expect(admin.groups[0]).toBe("Tool groups:");
	expect(admin.groups.filter((line) => line.startsWith("- "))).toEqual([
		expect.stringMatching(/^- bots: /),
		expect.stringMatching(/^- sharing: /),
		expect.stringMatching(/^- people: /),
	]);
	for (const [role, { section }] of [
		[
			"viewer",
			viewer,
		],
		[
			"admin",
			admin,
		],
	] as const) {
		expect(section).toHaveLength(8);
		expect(section[1]).toMatch(/^- Name: ".+"$/);
		expect(section[2]).toBe(
			`- Email: ${JSON.stringify(org.users[role].email)}`,
		);
		expect(section[3]).toBe(`- User id: ${org.users[role].id}`);
		expect(section[4]).toBe(`- Organisation: ${JSON.stringify(org.name)}`);
	}
	expect(viewer.section[5]).toBe("- Role: viewer");
	expect(viewer.section[6]).toBe("- Can: read");
	expect(viewer.section[7]).toContain("create_bot");
	expect(admin.section[5]).toBe("- Role: admin");
	expect(admin.section[6]).toContain("manage_organization");
	expect(admin.section[7]).toBe("- Cannot: nothing");
});

test("assistant: an unknown docs page is a tool error the turn answers past", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const answer = "The docs do not have that page.";

	inference.script(
		{
			toolCalls: [
				{
					name: "readDocs",
					input: {
						path: "/docs/missing",
					},
				},
			],
		},
		{
			text: answer,
		},
	);

	expect(await ask(member, chatId, "What is on the missing page?")).toBe(
		answer,
	);

	expect((await fetch(`${docsFetchUrl}/docs/missing.md`)).status).toBe(404);
	const requests = turnRequests(inference);
	expect(requests).toHaveLength(2);
	expect(toolResultsOf(requests[1]).join("\n")).toContain(
		"NOT_FOUND: No docs page at /docs/missing; read the index (call readDocs without a path) for valid paths.",
	);
});

test("assistant: plain chats are not offered readDocs", async ({
	api,
	inference,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Plain"));

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "How do I make a bot?",
			reply: "Not from the docs.",
		},
	});

	const [request] = turnRequests(inference);
	expect(request).toBeDefined();
	expect(offeredToolsOf(request)).not.toContain("readDocs");
});
