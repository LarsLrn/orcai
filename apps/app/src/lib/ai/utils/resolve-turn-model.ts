import type { ModelId, OrganizationId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ChatConfig, ChatKind, ModelCapability } from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** The model a turn asks for: the chat's own, or the organisation's assistant model. */
export const requestedTurnModel = ({
	kind,
	config,
	assistantModelId,
}: {
	kind: ChatKind;
	config: ChatConfig | null;
	assistantModelId: ModelId | null;
}): Effect.Effect<
	{
		modelId: ModelId;
		providerId: ProviderId | undefined;
	},
	AppErrors.BadRequestError
> => {
	if (kind === "assistant") {
		return assistantModelId
			? Effect.succeed({
					modelId: assistantModelId,
					providerId: undefined,
				})
			: Effect.fail(
					new AppErrors.BadRequestError({
						reason: "ASSISTANT_MODEL_NOT_CONFIGURED",
						message:
							"The organisation has no assistant model. An admin can choose one on the organisation page.",
					}),
				);
	}

	return config?.providerId && config.modelId
		? Effect.succeed({
				modelId: config.modelId,
				providerId: config.providerId,
			})
		: Effect.fail(
				new AppErrors.BadRequestError({
					reason: "CHAT_MODEL_NOT_CONFIGURED",
					message:
						"Chat is missing model or provider configuration. Please select a model in chat settings.",
				}),
			);
};

/** Refuses a model missing from the active organisation, or one without tool calling. */
export const checkTurnModel = <
	Model extends {
		providerId: ProviderId;
		capabilities: ModelCapability[];
	},
>({
	modelId,
	model,
}: {
	modelId: ModelId;
	model: Model | undefined;
}): Effect.Effect<
	Model,
	AppErrors.NotFoundError | AppErrors.BadRequestError
> => {
	if (!model) {
		return Effect.fail(
			new AppErrors.NotFoundError({
				reason: "MODEL_NOT_FOUND",
				id: modelId,
				message:
					"The model of this turn is not available in this organisation.",
			}),
		);
	}

	if (!model.capabilities.includes("tool-calling")) {
		return Effect.fail(
			new AppErrors.BadRequestError({
				reason: "MODEL_TOOLS_UNSUPPORTED",
				message:
					"Selected model does not support tool calling. Please choose a chat-capable model.",
			}),
		);
	}

	return Effect.succeed(model);
};

/** The provider and model a turn runs on, read live for assistant conversations. */
export const resolveTurnModel = ({
	chat,
	organizationId,
}: {
	chat: {
		kind: ChatKind;
		config: ChatConfig | null;
	};
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const assistantModelId =
			chat.kind === "assistant"
				? ((yield* db.query.organization.findFirst({
						where: {
							id: {
								eq: organizationId,
							},
						},
						columns: {
							assistantModelId: true,
						},
					}))?.assistantModelId ?? null)
				: null;

		const requested = yield* requestedTurnModel({
			kind: chat.kind,
			config: chat.config,
			assistantModelId,
		});

		const [row] = yield* db
			.select({
				providerId: dbSchema.model.providerId,
				capabilities: dbSchema.model.capabilities,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, requested.modelId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		const model = yield* checkTurnModel({
			modelId: requested.modelId,
			model: row,
		});

		return {
			modelId: requested.modelId,
			providerId: requested.providerId ?? model.providerId,
		};
	});
