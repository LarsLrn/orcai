import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatId, ModelId, ProviderId } from "@orcai/core";
import type { ORPCError } from "@orpc/client";
import { expect, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { rejection } from "../authorization";
import {
	type ChatModel,
	chatName,
	completionRequests,
	composer,
	setUpChatModel,
	streamedText,
} from "../chat/chat";
import type { Api, WorkerOrganisation } from "../index";
import type { InferenceMock } from "../inference/fixture";
import { message } from "../messages";
import { open } from "../navigation";
import { runId } from "../organisation";

/**
 * A chat model on the mock, set as the organisation's assistant model. Returns
 * the model, whose `providerModelId` is the mock's chat model.
 */
export const setUpAssistantModel = async (
	api: Api,
	org: WorkerOrganisation,
	inference: InferenceMock,
): Promise<ChatModel> => {
	const model = await setUpChatModel(api, inference);

	await setAssistantModel(api.as("admin"), org, model.modelId);

	return model;
};

/** Set or clear the assistant model of an organisation as its admin. */
export const setAssistantModel = async (
	admin: ApiClient,
	org: WorkerOrganisation,
	modelId: ModelId | null,
): Promise<void> => {
	await admin.organization.update({
		id: org.id,
		assistantModelId: modelId,
	});
};

/** A further model on a mock provider, usable unless overridden. */
export const createMockModel = async (
	admin: ApiClient,
	providerId: ProviderId,
	overrides: {
		name?: string;
		isDeprecated?: boolean;
		capabilities?: ("text" | "tool-calling")[];
	} = {},
): Promise<{
	modelId: ModelId;
	name: string;
	providerModelId: string;
}> => {
	const providerModelId = `e2e-mock-assistant-${runId()}`;
	const name = overrides.name ?? chatName("Model");
	const created = await admin.model.create({
		providerId,
		providerModelId,
		name,
		description: "A further model on the mock for the assistant slice.",
		isDeprecated: overrides.isDeprecated ?? false,
		capabilities: overrides.capabilities ?? [
			"text",
			"tool-calling",
		],
	});

	return {
		modelId: created.data.id,
		name,
		providerModelId,
	};
};

/** Start an assistant conversation in the client's active organisation. */
export const startConversation = async (client: ApiClient): Promise<ChatId> => {
	const created = await client.assistant.create({});

	return created.data.id;
};

/** The error a turn is refused with, whether the call or its stream fails. */
export const turnRefusal = async (
	client: ApiClient,
	chatId: ChatId,
): Promise<ORPCError<string, unknown>> =>
	await rejection(
		(async () => {
			const stream = await client.ai.chat({
				chatId,
				message: {
					id: randomUUID(),
					role: "user",
					parts: [
						{
							type: "text",
							text: "Is anyone there?",
						},
					],
				},
			});

			for (
				let step = await stream.next();
				!step.done;
				step = await stream.next()
			) {
				// Drain until the stream ends or fails.
			}
		})(),
	);

/** The reason code an oRPC error carries. */
export const reasonOf = (error: ORPCError<string, unknown>): unknown =>
	error.data !== null &&
	typeof error.data === "object" &&
	"reason" in error.data
		? error.data.reason
		: undefined;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object";

export const quoted = (name: string): string =>
	message("assistant_tool_quoted_name", {
		name,
	});

const catalogue = JSON.parse(
	readFileSync(
		join(import.meta.dirname, "../../../app/messages/en.json"),
		"utf8",
	),
) as Record<string, unknown>;

/** The texts of a message's variants, by their selector. */
const variantsOf = (key: string): Record<string, string> => {
	const value = catalogue[key];
	const [variant] = Array.isArray(value) ? value : [];
	if (!isRecord(variant) || !isRecord(variant.match)) {
		throw new Error(`Message "${key}" has no variants.`);
	}

	return variant.match as Record<string, string>;
};

/** The English text of a message pluralised on `count`. */
export const pluralMessage = (
	key: string,
	variables: Record<string, string | number> & {
		count: number;
	},
): string => {
	const category = new Intl.PluralRules("en").select(variables.count);
	const text = Object.entries(variantsOf(key)).find(([selector]) =>
		selector.endsWith(`=${category}`),
	)?.[1];
	if (text === undefined) {
		throw new Error(`Message "${key}" has no "${category}" variant.`);
	}

	return text.replace(/\{(\w+)\}/g, (_match, name: string) =>
		String(variables[name]),
	);
};

const escapeRegExp = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Any English rendering of the messages, whatever their variables hold. */
export const messagePattern = (...keys: string[]): RegExp =>
	new RegExp(
		`^(?:${keys
			.flatMap((key) => {
				const value = catalogue[key];

				return typeof value === "string"
					? [
							value,
						]
					: Object.values(variantsOf(key));
			})
			.map((text) =>
				text
					.split(/\{\w+\}/)
					.map(escapeRegExp)
					.join(".+"),
			)
			.join("|")})$`,
	);

/** Names sorted for set comparison. */
export const sortedNames = (names: string[]): string[] =>
	[
		...names,
	].sort();

/** The streamed completion requests of turns; title generation does not stream. */
export const turnRequests = (
	inference: InferenceMock,
): Record<string, unknown>[] =>
	completionRequests(inference)
		.map((request) => request.body)
		.filter(
			(body): body is Record<string, unknown> =>
				isRecord(body) && body.stream === true,
		);

/** The mock model the latest turn asked for. */
export const lastTurnModel = (inference: InferenceMock): unknown =>
	turnRequests(inference).at(-1)?.model;

/** Open the assistant start page and wait for its history. */
export const openAssistant = async (page: Page): Promise<void> => {
	await open(page, "/app/assistant");
	await expect(
		page.getByRole("heading", {
			name: message("assistant_history_title"),
		}),
	).toBeVisible();
};

/** Open an assistant conversation and wait for its transcript. */
export const openConversation = async (
	page: Page,
	chatId: ChatId,
): Promise<void> => {
	await open(page, `/app/assistant/${chatId}`);
	await expect(conversationLog(page)).toBeVisible();
};

export const conversationLog = (page: Page) => page.getByRole("log");

/** The read-only model name in the composer footer. */
export const composerModel = (page: Page, name: string) =>
	page
		.locator("form")
		.filter({
			has: composer(page),
		})
		.getByText(name, {
			exact: true,
		});

/** A conversation in the assistant history, by its title. */
export const historyEntry = (page: Page, title: string) =>
	page
		.getByRole("region", {
			name: message("assistant_history_title"),
		})
		.getByRole("link", {
			name: title,
			exact: true,
		});

/** The assistant model field on the organisation page: the model picker and its clear action. */
export const assistantModelField = (page: Page) =>
	page.getByRole("group", {
		name: message("orgs_form_assistant_model_label"),
	});

/** The open model picker dialog. */
export const modelPickerDialog = (page: Page) =>
	page.getByRole("dialog", {
		name: message("chat_model_selector_dialog_title"),
	});

/** Open the assistant model picker on one provider's models, narrowed by a search. */
export const openAssistantModelPicker = async (
	page: Page,
	providerName: string,
	search: string,
): Promise<void> => {
	await assistantModelField(page).getByRole("button").first().click();
	const dialog = modelPickerDialog(page);
	await dialog.getByRole("combobox").click();
	await page
		.getByRole("option", {
			name: providerName,
			exact: true,
		})
		.click();
	await dialog.getByRole("textbox").fill(search);
};

/** Pick a model in the open picker. */
export const pickModel = async (page: Page, modelName: string) => {
	await modelPickerDialog(page)
		.getByRole("option", {
			name: new RegExp(modelName),
		})
		.click();
	await expect(modelPickerDialog(page)).toHaveCount(0);
};

const messagesOf = (body: unknown): Record<string, unknown>[] =>
	isRecord(body) && Array.isArray(body.messages) ? body.messages : [];

/** The system message a completion request starts with. */
export const systemPromptOf = (body: unknown): string => {
	const content = messagesOf(body).find(
		(entry) => entry.role === "system",
	)?.content;

	return typeof content === "string" ? content : "";
};

/** The contents of the tool messages a completion request carries, oldest first. */
export const toolResultsOf = (body: unknown): string[] =>
	messagesOf(body).flatMap((entry) =>
		entry.role === "tool" && typeof entry.content === "string"
			? [
					entry.content,
				]
			: [],
	);

/** The names of the tools a completion request offers. */
export const offeredToolsOf = (body: unknown): string[] =>
	isRecord(body) && Array.isArray(body.tools)
		? body.tools.flatMap((entry: unknown) =>
				isRecord(entry) &&
				isRecord(entry.function) &&
				typeof entry.function.name === "string"
					? [
							entry.function.name,
						]
					: [],
			)
		: [];

/**
 * A conversation past its first turn, so the title it generates on the way
 * takes no scripted step from the turns a spec scripts next.
 */
export const startTitledConversation = async (
	client: ApiClient,
	inference: InferenceMock,
): Promise<ChatId> => {
	const chatId = await startConversation(client);
	const reply = chatName("Conversation");

	inference.respondWith({
		text: reply,
	});
	await streamedText(
		await client.ai.chat({
			chatId,
			message: {
				id: randomUUID(),
				role: "user",
				parts: [
					{
						type: "text",
						text: "Hello",
					},
				],
			},
		}),
	);
	await expect
		.poll(
			async () =>
				(
					await client.chat.find({
						id: chatId,
					})
				).data.title,
		)
		.toBe(reply);
	inference.reset();

	return chatId;
};

/** The core tools every role is offered, `listMembers` and `loadTools` aside. */
export const VIEWER_TOOLS = [
	"readDocs",
	"updatePlan",
	"askUser",
	"showChecklist",
	"showReview",
	"showMatrix",
	"showQuizResult",
	"findBots",
	"getBot",
	"getBlock",
	"findBlocks",
	"findAssets",
	"listGroups",
];

export const BOTS_TOOLS = [
	"findModels",
	"createBot",
	"updateBot",
	"publishBot",
	"deleteBot",
	"createTemplate",
	"updateTemplate",
	"createRepository",
	"updateRepository",
	"deleteBlock",
	"updateAsset",
	"deleteAsset",
	"retryAsset",
	"requestUpload",
];

export const SHARING_TOOLS = [
	"listAccess",
	"findPrincipals",
	"grantAccess",
	"revokeAccess",
];

export const PEOPLE_TOOLS = [
	"createGroup",
	"updateGroup",
	"deleteGroup",
	"addGroupMembers",
	"removeGroupMembers",
	"listGroupMembers",
	"changeMemberRole",
	"removeMembers",
	"inviteMembers",
	"listInvitations",
	"cancelInvitation",
];

/** The names of the tools a request offers, sorted for set comparison. */
export const offeredTools = (body: unknown): string[] =>
	sortedNames(offeredToolsOf(body));

/** The parsed JSON of each tool message a request carries; text results stay strings. */
export const toolMessages = (body: unknown): unknown[] =>
	toolResultsOf(body).map((content) => {
		try {
			return JSON.parse(content) as unknown;
		} catch {
			return content;
		}
	});

/** The names of the tool calls a request's history carries, oldest first. */
export const historyToolCallsOf = (body: unknown): string[] =>
	messagesOf(body).flatMap((entry) =>
		Array.isArray(entry.tool_calls)
			? entry.tool_calls.flatMap((call: unknown) =>
					isRecord(call) &&
					isRecord(call.function) &&
					typeof call.function.name === "string"
						? [
								call.function.name,
							]
						: [],
				)
			: [],
	);

/**
 * Wait until the turn's `count`th request arrived and its scripted response
 * is held, so a spec can script the next steps from what it carries.
 */
export const heldTurnRequest = async (
	inference: InferenceMock,
	count: number,
): Promise<Record<string, unknown>> => {
	await expect
		.poll(() => turnRequests(inference).length >= count && inference.held())
		.toBe(1);
	const request = turnRequests(inference)[count - 1];
	if (!request) throw new Error(`Missing turn request ${String(count)}`);

	return request;
};

/** The header of the newest work log, which opens it. */
export const workLogToggle = (page: Page) =>
	page
		.getByRole("log")
		.getByRole("button", {
			name: messagePattern(
				"chat_work_log_header_steps",
				"chat_work_log_header_steps_failed",
			),
		})
		.last();

/** Expand the newest turn's folded work log. */
export const expandWorkLog = async (page: Page): Promise<void> => {
	await workLogToggle(page).click();
};
