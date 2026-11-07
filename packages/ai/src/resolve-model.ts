import {
	isModelProviderKind,
	type ModelId,
	type ModelProviderKind,
	type OrganizationId,
	type ProviderId,
	type ProviderKind,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type ModelCapability,
	type ModelTokenLimits,
	type ModelUnusableReason,
	type ModelUse,
	modelUnusableReason,
} from "@orcai/schema";
import type { LanguageModel, LanguageModelMiddleware } from "ai";
import { eq } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { type AgentModel, agentModel } from "./agent-model";
import { providerApiKey } from "./provider-key";

/** A model's row and its provider's, however they were read. */
export interface ModelRows {
	model: {
		id: ModelId;
		providerModelId: string;
		capabilities: readonly ModelCapability[] | null;
		isDeprecated: boolean;
		contextWindow: number | null;
		maxOutputTokens: number | null;
	};
	provider: {
		id: ProviderId;
		kind: ProviderKind;
		endpoint: string | null;
		enabled: boolean;
	};
}

/** A model ready to call, and what its calls are metered against. */
export interface MeteredModel {
	readonly language: LanguageModel;
	readonly kind: ModelProviderKind;
	readonly providerId: ProviderId;
	readonly modelId: ModelId;
}

export interface ResolvedModel extends AgentModel, MeteredModel {
	readonly capabilities: readonly ModelCapability[];
	readonly tokenLimits: ModelTokenLimits;
}

export type ModelRefusal<Use extends ModelUse = ModelUse> =
	| ModelUnusableReason<Use>
	| "PROVIDER_PURPOSE_MISMATCH";

/** The model cannot carry a turn. */
export class ModelUnusableError extends Data.TaggedError("ModelUnusableError")<{
	readonly reason: ModelRefusal<"turn">;
}> {}

type KeyRead = ReturnType<typeof providerApiKey>;
type Resolved<A> = Effect.Effect<
	A,
	Effect.Error<KeyRead>,
	Effect.Services<KeyRead>
>;

interface ResolveOptions<Purpose extends ModelUse> {
	purpose: Purpose;
	middleware?: LanguageModelMiddleware[];
}

/**
 * The model of `rows` for `purpose`. A model that cannot carry a turn fails
 * the turn; one that cannot write text leaves the text call to a fallback,
 * with a warning.
 */
export function resolveModel(
	rows: ModelRows,
	options: ResolveOptions<"turn">,
): Effect.Effect<
	ResolvedModel,
	ModelUnusableError | Effect.Error<KeyRead>,
	Effect.Services<KeyRead>
>;
export function resolveModel(
	rows: ModelRows,
	options: ResolveOptions<"text">,
): Resolved<ResolvedModel | undefined>;
export function resolveModel(
	{ model, provider }: ModelRows,
	{ purpose, middleware }: ResolveOptions<ModelUse>,
) {
	return Effect.gen(function* () {
		const { kind } = provider;
		const { capabilities } = model;
		const reason =
			modelUnusableReason(
				{
					capabilities,
					isDeprecated: model.isDeprecated,
					providerEnabled: provider.enabled,
				},
				purpose,
			) ??
			(isModelProviderKind(kind) ? undefined : "PROVIDER_PURPOSE_MISMATCH");
		// The reason covers both; the checks narrow the types.
		if (reason !== undefined || !capabilities || !isModelProviderKind(kind)) {
			if (purpose === "turn") {
				return yield* new ModelUnusableError({
					reason: reason as ModelRefusal<"turn">,
				});
			}
			yield* Effect.logWarning(
				`model ${model.id} cannot write text (${reason})`,
			);
			return undefined;
		}

		return {
			...agentModel({
				kind,
				connection: {
					apiKey: yield* providerApiKey(provider.id),
					endpoint: provider.endpoint,
				},
				providerModelId: model.providerModelId,
				middleware,
			}),
			providerId: provider.id,
			modelId: model.id,
			capabilities,
			tokenLimits: {
				contextWindow: model.contextWindow,
				maxOutputTokens: model.maxOutputTokens,
			},
		} satisfies ResolvedModel;
	});
}

/** The organisation's utility model when it can write text; undefined when it has none or an unusable one. */
export const utilityModel = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select({
				model: {
					id: dbSchema.model.id,
					providerModelId: dbSchema.model.providerModelId,
					capabilities: dbSchema.model.capabilities,
					isDeprecated: dbSchema.model.isDeprecated,
					contextWindow: dbSchema.model.contextWindow,
					maxOutputTokens: dbSchema.model.maxOutputTokens,
				},
				provider: {
					id: dbSchema.provider.id,
					kind: dbSchema.provider.kind,
					endpoint: dbSchema.provider.endpoint,
					enabled: dbSchema.provider.enabled,
				},
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
		return row
			? yield* resolveModel(row, {
					purpose: "text",
				}).pipe(Effect.annotateLogs("organizationId", organizationId))
			: undefined;
	});
