import * as Effect from "effect/Effect";
import {
	type FeatureCatalog,
	type FeatureEntry,
	featureCatalog,
} from "./catalog";

export interface ResolvedFeature {
	id: string;
	entry: FeatureEntry;
	settings: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const skip = (id: string, reason: string) =>
	Effect.logWarning(`feature.skipped id=${id} reason=${reason}`);

/**
 * The usable features of a stored features map, in catalog order. Unknown
 * ids and settings that no longer parse are skipped.
 */
export const resolveFeatures = (
	features: unknown,
	catalog: FeatureCatalog = featureCatalog,
) =>
	Effect.gen(function* () {
		if (!isRecord(features)) {
			return [];
		}

		for (const id of Object.keys(features)) {
			if (!Object.hasOwn(catalog, id)) {
				yield* skip(id, "unknown");
			}
		}

		const usable: ResolvedFeature[] = [];
		for (const [id, entry] of Object.entries(catalog)) {
			if (!Object.hasOwn(features, id)) {
				continue;
			}
			const parsed = entry.settingsSchema.safeParse(features[id]);
			if (parsed.success) {
				usable.push({
					id,
					entry,
					settings: parsed.data,
				});
			} else {
				yield* skip(id, "invalid_settings");
			}
		}

		return usable;
	});
