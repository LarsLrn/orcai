import {
	buildChatTitlePrompt,
	getChatTitleSourceText,
	sanitizeGeneratedChatTitle,
	shouldGenerateChatTitle,
	titleCallSettings,
} from "@orcai/ai";
import type {
	ChatId,
	OrganizationId,
	ProviderId,
	ProviderKind,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { LanguageModel, ModelMessage } from "ai";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { generateTextWithQuota } from "./generate-text-with-quota";

const TITLE_GENERATION_TIMEOUT_MS = 15_000;

interface TitleMessage {
	id: string;
	role: string;
	parts: unknown;
}

const buildTitleReservationMessages = (
	userMessageText: string,
): ModelMessage[] => [
	{
		role: "user",
		content: userMessageText,
	},
];

interface TitleRequest {
	chatId: ChatId;
	model: LanguageModel;
	providerKind: ProviderKind;
	organizationId: OrganizationId;
	providerId: ProviderId;
	providerModelId: string | null;
	userId: UserId;
	userMessageId: string;
	userMessageText: string;
}

/** A chat's title from its first message, without reasoning where the kind allows; null when the reply holds none. */
export const generateChatTitle = (params: TitleRequest) =>
	Effect.gen(function* () {
		const { text } = yield* generateTextWithQuota({
			operation: "ai.chat.generateTitle",
			appRequestId: `title:${params.chatId}:${params.userMessageId}`,
			organizationId: params.organizationId,
			userId: params.userId,
			providerId: params.providerId,
			providerModelId: params.providerModelId,
			model: params.model,
			prompt: buildChatTitlePrompt(params.userMessageText),
			...titleCallSettings(params.providerKind),
			reservationMessages: buildTitleReservationMessages(
				params.userMessageText,
			),
			timeoutMs: TITLE_GENERATION_TIMEOUT_MS,
		});

		return sanitizeGeneratedChatTitle(text);
	});

const generateAndPersistChatTitle = (params: TitleRequest) =>
	Effect.gen(function* () {
		const sanitizedTitle = yield* generateChatTitle(params);
		if (!sanitizedTitle) {
			return yield* Effect.logWarning(
				`chat ${params.chatId} got no title from its model`,
			);
		}

		const db = yield* DB;
		yield* db
			.update(dbSchema.chat)
			.set({
				title: sanitizedTitle,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(dbSchema.chat.id, params.chatId),
					or(isNull(dbSchema.chat.title), eq(dbSchema.chat.title, "")),
				),
			);
	});

export const forkChatTitleGenerationIfNeeded = (params: {
	chatId: ChatId;
	currentTitle: string | null;
	model: LanguageModel;
	providerKind: ProviderKind;
	organizationId: OrganizationId;
	providerId: ProviderId;
	providerModelId: string | null;
	userId: UserId;
	userMessage: TitleMessage;
}) =>
	Effect.gen(function* () {
		if (
			!shouldGenerateChatTitle(params.currentTitle) ||
			params.userMessage.role !== "user"
		) {
			return;
		}

		const userMessageText = getChatTitleSourceText({
			parts: Array.isArray(params.userMessage.parts)
				? params.userMessage.parts
				: [],
		});

		if (!userMessageText) {
			return;
		}

		yield* Effect.forkDetach(
			generateAndPersistChatTitle({
				chatId: params.chatId,
				model: params.model,
				providerKind: params.providerKind,
				organizationId: params.organizationId,
				providerId: params.providerId,
				providerModelId: params.providerModelId,
				userId: params.userId,
				userMessageId: params.userMessage.id,
				userMessageText,
			}).pipe(
				Effect.catchCause((cause) =>
					Effect.logWarning(
						`chat ${params.chatId} title generation failed ${Cause.pretty(cause)}`,
					),
				),
			),
		);
	});
