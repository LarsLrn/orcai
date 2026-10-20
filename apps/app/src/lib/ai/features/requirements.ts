import type { FeatureId } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { BadRequestError } from "@/lib/effect/utils/errors";
import { type FeatureCatalog, featureCatalog } from "./catalog";

const isEnabled = (features: Record<string, unknown>, id: string) =>
	features[id] !== undefined;

/** Fails on the first enabled feature whose required features are not all enabled. */
export const checkFeatureRequirements = (
	features: Record<string, unknown>,
	catalog: FeatureCatalog = featureCatalog,
) =>
	Effect.gen(function* () {
		for (const [id, entry] of Object.entries(catalog)) {
			if (!isEnabled(features, id)) {
				continue;
			}

			const missing = entry.requires.find(
				(requirement) => !isEnabled(features, requirement),
			);

			if (missing) {
				return yield* new BadRequestError({
					reason: "FEATURE_REQUIREMENT_MISSING",
					params: {
						feature: id as FeatureId,
						requirement: missing as FeatureId,
					},
					message: `Feature "${id}" requires "${missing}".`,
				});
			}
		}
	});
