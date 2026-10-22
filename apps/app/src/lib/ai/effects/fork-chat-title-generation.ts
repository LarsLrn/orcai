import {
	buildChatTitlePrompt,
	getChatTitleSourceText,
	sanitizeGeneratedChatTitle,
	shouldGenerateChatTitle,
	titleCallSettings,
} from "@orcai/ai";
import {
	type ChatId,
	isModelProviderKind,
	type ModelId,
	type ModelProviderKind,
	type OrganizationId,
	type ProviderId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { LanguageModel, ModelMessage } from "ai";
import { and, eq, isNull, or } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { agentModel } from "@/lib/ai/agents/agent-model";
import { modelUnusableReason } from "@/lib/ai/turn/model-usability";
import { providerApiKey } from "@/lib/encryption";
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

/** A model a title can be written with, and what its call is metered against. */
interface TitleModel {
	language: LanguageModel;
	kind: ModelProviderKind;
	providerId: ProviderId;
	modelId: ModelId;
}

interface TitleRequest {
	chatId: ChatId;
	model: TitleModel;
	organizationId: OrganizationId;
	userId: UserId;
	userMessageId: string;
	userMessageText: string;
}

/** The organisation's utility model when it can write text, else `chatModel`. */
const titleModel = (organizationId: OrganizationId, chatModel: TitleModel) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [utility] = yield* db
			.select({
				modelId: dbSchema.model.id,
				providerModelId: dbSchema.model.providerModelId,
				capabilities: dbSchema.model.capabilities,
				isDeprecated: dbSchema.model.isDeprecated,
				providerId: dbSchema.provider.id,
				kind: dbSchema.provider.kind,
				endpoint: dbSchema.provider.endpoint,
				providerEnabled: dbSchema.provider.enabled,
			})
			.from(dbSchema.organization)
			.innerJoin(
				dbSchema.model,
				eq(dbSchema.model.id, dbSchema.organization.utilityModelId),
			)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(eq(dbSchema.organization.id, organizationId))
			.limit(1);
		if (!utility) {
			return chatModel;
		}

		const { kind } = utility;
		const unusable = modelUnusableReason(utility, "text");
		if (unusable || !isModelProviderKind(kind)) {
			yield* Effect.logWarning(
				`organisation ${organizationId} has an unusable utility model (${unusable ?? "PROVIDER_PURPOSE_MISMATCH"}), titles use the chat's model`,
			);
			return chatModel;
		}

		return {
			language: agentModel({
				kind,
				connection: {
					apiKey: yield* providerApiKey(utility.providerId),
					endpoint: utility.endpoint,
				},
				providerModelId: utility.providerModelId,
			}).language,
			kind,
			providerId: utility.providerId,
			modelId: utility.modelId,
		} satisfies TitleModel;
	});

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
	chatModel: TitleModel;
}) =>
	Effect.gen(function* () {
		const sanitizedTitle = yield* generateChatTitle({
			...params,
			model: yield* titleModel(params.organizationId, chatModel),
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
	chatModel: TitleModel;
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
