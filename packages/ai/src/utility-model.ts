import {
	isModelProviderKind,
	type ModelId,
	type ModelProviderKind,
	type OrganizationId,
	type ProviderId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { type ModelCapability, modelUnusableReason } from "@orcai/schema";
import type { LanguageModel } from "ai";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { agentModel } from "./agent-model";
import { providerApiKey } from "./provider-key";

/** A model ready to call, and what its calls are metered against. */
export interface MeteredModel {
	readonly language: LanguageModel;
	readonly kind: ModelProviderKind;
	readonly providerId: ProviderId;
	readonly modelId: ModelId;
}

export interface UtilityModel extends MeteredModel {
	readonly capabilities: readonly ModelCapability[];
}

/**
 * The organisation's utility model when it can write text; undefined when the
 * organisation has none or an unusable one, which is logged.
 */
export const utilityModel = (organizationId: OrganizationId) =>
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
			return undefined;
		}

		const { kind, capabilities } = utility;
		const unusable = modelUnusableReason(utility, "text");
		if (unusable || !capabilities || !isModelProviderKind(kind)) {
			yield* Effect.logWarning(
				`organisation ${organizationId} has an unusable utility model (${unusable ?? "PROVIDER_PURPOSE_MISMATCH"})`,
			);
			return undefined;
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
			capabilities,
		} satisfies UtilityModel;
	});
