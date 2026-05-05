import {
	buildChatTitlePrompt,
	DEFAULT_CHAT_TITLE,
	getChatTitleSourceText,
	sanitizeGeneratedChatTitle,
	shouldGenerateChatTitle,
} from "@orcai/ai";
import type { ChatId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { LanguageModel, ModelMessage } from "ai";
import { and, eq, isNull, or } from "drizzle-orm";
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

const generateAndPersistChatTitle = (params: {
	chatId: ChatId;
	model: LanguageModel;
	organizationId: OrganizationId;
	providerId: ProviderId;
	providerModelId: string | null;
	userId: UserId;
	userMessageId: string;
	userMessageText: string;
}) =>
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
			reservationMessages: buildTitleReservationMessages(
				params.userMessageText,
			),
			isFirstTurn: true,
			timeoutMs: TITLE_GENERATION_TIMEOUT_MS,
		});

		const sanitizedTitle = sanitizeGeneratedChatTitle(text);
		if (!sanitizedTitle) {
			return;
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
					or(
						isNull(dbSchema.chat.title),
						eq(dbSchema.chat.title, ""),
						eq(dbSchema.chat.title, DEFAULT_CHAT_TITLE),
					),
				),
			);
	});

export const forkChatTitleGenerationIfNeeded = (params: {
	chatId: ChatId;
	currentTitle: string | null;
	model: LanguageModel;
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
				organizationId: params.organizationId,
				providerId: params.providerId,
				providerModelId: params.providerModelId,
				userId: params.userId,
				userMessageId: params.userMessage.id,
				userMessageText,
			}).pipe(Effect.catch(() => Effect.void)),
		);
	});
