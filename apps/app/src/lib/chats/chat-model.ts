import {
	isModelProviderKind,
	type ModelId,
	type OrganizationId,
	type ProviderId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** A chat's max tokens stay within its model's max output, where that is known. */
export const checkMaxTokens = ({
	modelId,
	maxTokens,
	organizationId,
}: {
	modelId: ModelId | null | undefined;
	maxTokens: number | null | undefined;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		if (modelId == null || maxTokens == null) {
			return;
		}

		const db = yield* DB;
		const [model] = yield* db
			.select({
				maxOutputTokens: dbSchema.model.maxOutputTokens,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, modelId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (model?.maxOutputTokens != null && maxTokens > model.maxOutputTokens) {
			return yield* new AppErrors.BadRequestError({
				reason: "CHAT_MAX_TOKENS_EXCEEDS_MODEL",
				params: {
					maxOutputTokens: model.maxOutputTokens,
				},
				message: "Max tokens exceed the model's max output tokens.",
			});
		}
	});

/** A chat's provider is a model provider of the organisation, and its model belongs to it. */
export const checkChatModel = ({
	providerId,
	modelId,
	organizationId,
}: {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		if (providerId == null && modelId == null) {
			return;
		}

		const db = yield* DB;

		if (providerId != null) {
			const [provider] = yield* db
				.select({
					kind: dbSchema.provider.kind,
				})
				.from(dbSchema.provider)
				.where(
					and(
						eq(dbSchema.provider.id, providerId),
						eq(dbSchema.provider.organizationId, organizationId),
					),
				)
				.limit(1);

			if (!provider) {
				return yield* new AppErrors.NotFoundError({
					reason: "PROVIDER_NOT_FOUND",
					id: providerId,
					message: "Provider not found",
				});
			}

			if (!isModelProviderKind(provider.kind)) {
				return yield* new AppErrors.BadRequestError({
					reason: "PROVIDER_PURPOSE_MISMATCH",
					message:
						"Selected provider is a search provider. Please choose a chat model.",
				});
			}
		}

		if (modelId != null) {
			const [model] = yield* db
				.select({
					providerId: dbSchema.model.providerId,
				})
				.from(dbSchema.model)
				.innerJoin(
					dbSchema.provider,
					eq(dbSchema.provider.id, dbSchema.model.providerId),
				)
				.where(
					and(
						eq(dbSchema.model.id, modelId),
						eq(dbSchema.provider.organizationId, organizationId),
					),
				)
				.limit(1);

			if (!model) {
				return yield* new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					id: modelId,
					message: "Model not found",
				});
			}

			if (providerId != null && model.providerId !== providerId) {
				return yield* new AppErrors.BadRequestError({
					reason: "MODEL_PROVIDER_MISMATCH",
					message:
						"Selected model does not belong to the selected provider. Please update chat settings.",
				});
			}
		}
	});
