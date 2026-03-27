import type { LanguageModel, ModelMessage } from "ai";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { generateTextWithQuotaEffect } from "@/lib/ai/effects/generate-text-with-quota";
import {
	buildChatTitlePrompt,
	DEFAULT_CHAT_TITLE,
	getChatTitleSourceText,
	sanitizeGeneratedChatTitle,
	shouldGenerateChatTitle,
} from "@/lib/ai/generate-chat-title";
import { DB } from "@/lib/effect/services/drizzle";

const TITLE_GENERATION_MAX_OUTPUT_TOKENS = 64;
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
	chatId: string;
	model: LanguageModel;
	orgId: string;
	providerId: string;
	providerModelId: string;
	userId: string;
	userMessageId: string;
	userMessageText: string;
}) =>
	Effect.gen(function* () {
		const { text } = yield* generateTextWithQuotaEffect({
			operation: "ai.chat.generateTitle",
			appRequestId: `title:${params.chatId}:${params.userMessageId}`,
			orgId: params.orgId,
			userId: params.userId,
			providerId: params.providerId,
			providerModelId: params.providerModelId,
			model: params.model,
			prompt: buildChatTitlePrompt(params.userMessageText),
			reservationMessages: buildTitleReservationMessages(
				params.userMessageText,
			),
			isFirstTurn: true,
			maxOutputTokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
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
	chatId: string;
	currentTitle: string | null;
	model: LanguageModel;
	orgId: string;
	providerId: string;
	providerModelId: string;
	userId: string;
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

		yield* Effect.forkDaemon(
			generateAndPersistChatTitle({
				chatId: params.chatId,
				model: params.model,
				orgId: params.orgId,
				providerId: params.providerId,
				providerModelId: params.providerModelId,
				userId: params.userId,
				userMessageId: params.userMessage.id,
				userMessageText,
			}).pipe(Effect.catchAll(() => Effect.void)),
		);
	});
