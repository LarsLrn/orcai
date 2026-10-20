import type { BotId, ChatId, ChatMessageId } from "@orcai/core";
import type { ORPCError } from "@orpc/client";
import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { rejection } from "../authorization";
import { ask, chatName, streamedText } from "../chat/chat";
import type { ScriptedStep, ScriptedToolCall } from "../inference/fixture";
import { message } from "../messages";
import { expandWorkLog, pluralMessage, quoted } from "./assistant";

/** A `loadTools` call loading deferred groups, to which every gated tool belongs. */
export const loadTools = (
	...groups: ("bots" | "sharing" | "people")[]
): ScriptedStep => ({
	toolCalls: [
		{
			name: "loadTools",
			input: {
				groups,
			},
		},
	],
});

/** A step whose text leads in to calls, as a model does before acting. */
export const actStep = (
	leadIn: string,
	...calls: ScriptedToolCall[]
): ScriptedStep => ({
	text: leadIn,
	toolCalls: calls,
});

export const deleteBotCall = (...ids: BotId[]): ScriptedToolCall => ({
	name: "deleteBot",
	input: {
		ids,
	},
});

/** A draft bot of the client's own, with nothing linked. */
export const createBot = async (
	client: ApiClient,
	label: string,
): Promise<{
	id: BotId;
	name: string;
}> => {
	const name = chatName(label);
	const saved = await client.bot.save({
		name,
		description: "Created by the assistant approval specs.",
		status: "draft",
		templateBlockId: null,
		databaseBlockIds: [],
	});

	return {
		id: saved.data.id,
		name,
	};
};

/** Whether the client can still read the bot. */
export const botExists = async (
	client: ApiClient,
	id: BotId,
): Promise<boolean> =>
	await client.bot
		.find({
			id,
		})
		.then(
			() => true,
			() => false,
		);

/** The card title of a `deleteBot` call on one bot. */
export const deleteBotTitle = (name: string): string =>
	pluralMessage("assistant_tool_delete_bot_summary", {
		count: 1,
		names: quoted(name),
	});

/** A Confirmation card in the conversation, by its summary line. */
export const confirmationCard = (page: Page, title: string): Locator =>
	page.getByRole("log").getByRole("group", {
		name: title,
		exact: true,
	});

/** A button of a card, by its exact label. */
export const cardButton = (card: Locator, label: string): Locator =>
	card.getByRole("button", {
		name: label,
		exact: true,
	});

export const cancelButton = (card: Locator): Locator =>
	cardButton(card, message("common_cancel_button"));

/** Open the newest work log and return its entry with a summary line. */
export const openWorkLogEntry = async (
	page: Page,
	line: string,
): Promise<Locator> => {
	await expandWorkLog(page);
	const entry = page
		.getByRole("log")
		.getByRole("listitem")
		.filter({
			has: page.getByText(line, {
				exact: true,
			}),
		});
	await expect(entry).toBeVisible();

	return entry;
};

/** Counts the page's `ai.continue` requests from now on. */
export const countContinuations = (page: Page): (() => number) => {
	let count = 0;

	page.on("request", (request) => {
		if (new URL(request.url()).pathname === "/api/rpc/ai/continue") count += 1;
	});

	return () => count;
};

export type StoredPart = {
	type: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
	approval?: {
		id: string;
		approved?: boolean;
		reason?: string;
	};
};

export type StoredRow = {
	id: ChatMessageId;
	role: string;
	parts: StoredPart[];
	/** The zedToken the row's turn settled, which reads after it need. */
	zedToken: string | undefined;
};

/** Every stored row of a conversation's newest page, oldest first. */
export const storedRows = async (
	client: ApiClient,
	chatId: ChatId,
): Promise<StoredRow[]> => {
	const page = await client.chatMessage.list({
		chatId,
		limit: 100,
	});

	return page.data.map((row) => ({
		id: row.id,
		role: row.role,
		parts: row.parts as StoredPart[],
		zedToken: row.metadata.zedToken,
	}));
};

/** The conversation's last stored row. */
export const lastRow = async (
	client: ApiClient,
	chatId: ChatId,
): Promise<StoredRow> => {
	const row = (await storedRows(client, chatId)).at(-1);
	if (!row) throw new Error(`Conversation ${chatId} has no rows`);

	return row;
};

/** A row's parts of one tool, oldest first. */
export const toolParts = (row: StoredRow, name: string): StoredPart[] =>
	row.parts.filter((part) => part.type === `tool-${name}`);

/** The approval ids a row waits on. */
export const pendingApprovalIds = (row: StoredRow): string[] =>
	row.parts.flatMap((part) =>
		part.state === "approval-requested" && part.approval
			? [
					part.approval.id,
				]
			: [],
	);

/** Ask over the API and drain the turn, which ends paused when a gated call comes up. */
export const pauseTurn = async (
	client: ApiClient,
	chatId: ChatId,
	question: string,
): Promise<StoredRow> => {
	await ask(client, chatId, question);

	return await lastRow(client, chatId);
};

/** Continue a paused reply over the API and drain its stream. */
export const continueTurn = async (
	client: ApiClient,
	input: {
		chatId: ChatId;
		messageId: ChatMessageId;
		approvals: {
			approvalId: string;
			approved: boolean;
		}[];
	},
): Promise<string> => await streamedText(await client.ai.continue(input));

/** The error a continuation is refused with, whether the call or its stream fails. */
export const continueRefusal = async (
	client: ApiClient,
	input: Parameters<typeof continueTurn>[1],
): Promise<ORPCError<string, unknown>> =>
	await rejection(continueTurn(client, input));

/** The id of the bot a row's first `createBot` call created. */
export const createdBotId = (row: StoredRow): BotId => {
	const [created] = toolParts(row, "createBot");
	const id = (
		created?.output as
			| {
					id?: BotId;
			  }
			| undefined
	)?.id;
	if (created?.state !== "output-available" || !id) {
		throw new Error(
			`createBot did not create: ${created?.errorText ?? "no call"}`,
		);
	}

	return id;
};
