import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import {
	branchActions,
	type ChatModel,
	chatName,
	completionRequests,
	composer,
	createChat,
	messageCount,
	messageText,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const turns = [
	{
		question: "Name a primary colour.",
		reply: "Red is a primary colour.",
	},
	{
		question: "Name another one.",
		reply: "Blue is another.",
	},
];

/** A chat of two turns, so a branch can start in its middle. */
const twoTurnChat = async (
	client: ApiClient,
	inference: InferenceMock,
	model: ChatModel,
	title: string,
): Promise<ChatId> => {
	const chatId = await createChat(client, model, title);

	for (const turn of turns) {
		await sendTurn({
			client,
			inference,
			chatId,
			turn,
		});
	}

	return chatId;
};

/** A search value as the router reads it: JSON when it parses, else raw. */
const searchValue = (raw: string | null): string | undefined => {
	if (raw === null) return undefined;
	try {
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "string" ? parsed : raw;
	} catch {
		return raw;
	}
};

/**
 * Click "Branch from here" on the message at `index` and wait for the new
 * chat, whose URL carries the revision that makes it readable.
 */
const branchFrom = async (
	page: Page,
	parentId: ChatId,
	index: number,
): Promise<{
	id: ChatId;
	zedToken?: string;
}> => {
	await branchActions(page).nth(index).click();
	await expect(page).not.toHaveURL(new RegExp(`/app/chat/${parentId}`));
	await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]{36}/);
	const url = new URL(page.url());

	return {
		id: url.pathname.split("/").at(-1) as ChatId,
		zedToken: searchValue(url.searchParams.get("zedToken")),
	};
};

test("branching from a reply opens a copy up to it, linked both ways", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const title = chatName("Branch Reply");
	const parentId = await twoTurnChat(member, inference, model, title);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, parentId);
	const branch = await branchFrom(page, parentId, 1);

	await expect(messageText(page, turns[0].question)).toBeVisible();
	await expect(messageText(page, turns[0].reply)).toBeVisible();
	await expect(messageText(page, turns[1].question)).toHaveCount(0);
	await expect(messageText(page, turns[1].reply)).toHaveCount(0);
	await expect(composer(page)).toHaveValue("");
	expect(await messageCount(member, branch.id, branch.zedToken)).toBe(2);

	const sidebarEntry = page.getByRole("link", {
		name: `${message("chat_branch_label")} ${title}`,
		exact: true,
	});
	await expect(
		sidebarEntry.getByRole("img", {
			name: message("chat_branch_label"),
		}),
	).toBeVisible();

	await page
		.getByRole("link", {
			name: message("chat_branched_from_link", {
				title,
			}),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/app/chat/${parentId}`));

	const branchesLabel = message("chat_message_branches_label");
	const branches = page.getByText(branchesLabel, {
		exact: true,
	});
	await expect(branches).toBeVisible();
	await expect(messageText(page, turns[1].reply)).toBeVisible();
	// A union matches in document order, which the log's scrolling cannot change.
	await expect(
		messageText(page, turns[0].reply)
			.or(branches)
			.or(messageText(page, turns[1].question)),
	).toHaveText([
		turns[0].reply,
		branchesLabel,
		turns[1].question,
	]);

	await page
		.getByRole("log")
		.getByRole("link", {
			name: title,
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/app/chat/${branch.id}`));
});

test("branching from a question prefills the composer and sends nothing", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const parentId = await twoTurnChat(
		member,
		inference,
		model,
		chatName("Branch Question"),
	);
	const completions = completionRequests(inference).length;

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, parentId);
	const branch = await branchFrom(page, parentId, 2);

	await expect(composer(page)).toHaveValue(turns[1].question);
	await expect(messageText(page, turns[0].question)).toBeVisible();
	await expect(messageText(page, turns[0].reply)).toBeVisible();
	await expect(messageText(page, turns[1].question)).toHaveCount(0);
	await expect(messageText(page, turns[1].reply)).toHaveCount(0);

	await page.waitForLoadState("networkidle");
	expect(completionRequests(inference)).toHaveLength(completions);
	expect(await messageCount(member, branch.id, branch.zedToken)).toBe(2);
});
