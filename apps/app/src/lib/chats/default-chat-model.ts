import {
	isModelProviderKind,
	type ModelId,
	type OrganizationId,
	type ProviderId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { coversModel, memberQuotaScopes, type QuotaScope } from "@orcai/quota";
import {
	type BotSetup,
	type ChatConfig,
	modelUnusableReason,
} from "@orcai/schema";
import { asc, desc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { seededConfig } from "./effective-model";

export type ChatModelChoice = {
	modelId: ModelId;
	providerId: ProviderId;
};

/** One of the organisation's models, and whether a turn can run on it. */
export type OrganizationChatModel = ChatModelChoice & {
	usable: boolean;
};

/**
 * The model a chat starts on when neither a required bot setup nor the user
 * chose one: the bot's recommended model, the organisation's default chat
 * model, then the organisation's models in list order. A model that is
 * unusable, not the organisation's, or covered by none of the member's pools
 * is skipped. Without a covered one, the first usable model, which the
 * composer then blocks for its missing pool.
 */
export const chatModelPrecedence = ({
	recommendedModelId,
	defaultModelId,
	models,
	scopes,
}: {
	recommendedModelId: ModelId | null;
	defaultModelId: ModelId | null;
	/** In list order. */
	models: readonly OrganizationChatModel[];
	scopes: readonly QuotaScope[];
}): ChatModelChoice | null => {
	const byId = new Map(
		models.map((model) => [
			model.modelId,
			model,
		]),
	);
	const candidates = [
		recommendedModelId,
		defaultModelId,
	]
		.flatMap((id) => (id ? (byId.get(id) ?? []) : []))
		.concat(models)
		.filter((model) => model.usable);
	const chosen =
		candidates.find((model) => coversModel(scopes, model)) ?? candidates[0];
	return chosen
		? {
				modelId: chosen.modelId,
				providerId: chosen.providerId,
			}
		: null;
};

/** The organisation's models in list order, newest first, with whether a turn can run on each. */
const organizationChatModels = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const rows = yield* (yield* DB)
			.select({
				modelId: dbSchema.model.id,
				providerId: dbSchema.model.providerId,
				capabilities: dbSchema.model.capabilities,
				isDeprecated: dbSchema.model.isDeprecated,
				providerEnabled: dbSchema.provider.enabled,
				providerKind: dbSchema.provider.kind,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(eq(dbSchema.provider.organizationId, organizationId))
			.orderBy(desc(dbSchema.model.createdAt), asc(dbSchema.model.id));
		return rows.map(
			(row): OrganizationChatModel => ({
				modelId: row.modelId,
				providerId: row.providerId,
				usable:
					isModelProviderKind(row.providerKind) &&
					modelUnusableReason(row, "turn") === undefined,
			}),
		);
	});

/** The model a chat of the member starts on by `chatModelPrecedence`, or null when the organisation has no usable one. */
export const defaultChatModel = ({
	organizationId,
	userId,
	recommendedModelId,
}: {
	organizationId: OrganizationId;
	userId: UserId;
	recommendedModelId: ModelId | null;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [models, [organization], scopes] = yield* Effect.all(
			[
				organizationChatModels(organizationId),
				db
					.select({
						defaultChatModelId: dbSchema.organization.defaultChatModelId,
					})
					.from(dbSchema.organization)
					.where(eq(dbSchema.organization.id, organizationId)),
				memberQuotaScopes({
					organizationId,
					userId,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);
		return chatModelPrecedence({
			recommendedModelId,
			defaultModelId: organization?.defaultChatModelId ?? null,
			models,
			scopes,
		});
	});

/**
 * What a new chat starts from. Without a model of its own, a bot's
 * recommendation gives way to `defaultChatModel` and seeds its settings only
 * when it wins. A required setup and an explicit choice stay as seeded.
 */
export const startingConfig = ({
	config,
	setup,
	organizationId,
	userId,
}: {
	config: ChatConfig;
	setup: BotSetup | null;
	organizationId: OrganizationId;
	userId: UserId;
}) =>
	Effect.gen(function* () {
		if (setup?.strength !== "recommended" || config.modelId != null) {
			return seededConfig(config, setup);
		}
		const chosen = yield* defaultChatModel({
			organizationId,
			userId,
			recommendedModelId: setup.model?.id ?? null,
		});
		return chosen && chosen.modelId !== setup.model?.id
			? {
					...config,
					...chosen,
				}
			: seededConfig(config, setup);
	});
