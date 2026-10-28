import {
	buildChatTitlePrompt,
	generateTextWithQuota,
	getChatTitleSourceText,
	type MeteredModel,
	sanitizeGeneratedChatTitle,
	shouldGenerateChatTitle,
	titleCallSettings,
	utilityModel,
} from "@orcai/ai";
import type { ChatId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ModelMessage } from "ai";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";

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
	model: MeteredModel;
	organizationId: OrganizationId;
	userId: UserId;
	userMessageId: string;
	userMessageText: string;
}

/** A chat's title from its first message, metered against `model` and without reasoning where its kind allows; null when the reply holds none. */
export const generateChatTitle = ({ model, ...params }: TitleRequest) =>
	Effect.gen(function* () {
		const { text } = yield* generateTextWithQuota({
			operation: "ai.chat.generateTitle",
			appRequestId: `title:${params.chatId}:${params.userMessageId}`,
			organizationId: params.organizationId,
			userId: params.userId,
			providerId: model.providerId,
			modelId: model.modelId,
			model: model.language,
			prompt: buildChatTitlePrompt(params.userMessageText),
			...titleCallSettings(model.kind),
			reservationMessages: buildTitleReservationMessages(
				params.userMessageText,
			),
			timeoutMs: TITLE_GENERATION_TIMEOUT_MS,
		});

		return sanitizeGeneratedChatTitle(text);
	});

const generateAndPersistChatTitle = ({
	chatModel,
	...params
}: Omit<TitleRequest, "model"> & {
	chatModel: MeteredModel;
}) =>
	Effect.gen(function* () {
		const sanitizedTitle = yield* generateChatTitle({
			...params,
			model: (yield* utilityModel(params.organizationId)) ?? chatModel,
		});
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

/** Writes the title of an untitled chat in the background, with the organisation's utility model or else the chat's. */
export const forkChatTitleGenerationIfNeeded = (params: {
	chatId: ChatId;
	currentTitle: string | null;
	/** The model of the chat's turn. */
	chatModel: MeteredModel;
	organizationId: OrganizationId;
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
				chatModel: params.chatModel,
				organizationId: params.organizationId,
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
