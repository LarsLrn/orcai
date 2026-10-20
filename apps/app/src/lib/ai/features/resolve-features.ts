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
 * ids, settings that no longer parse and unmet requirements are skipped.
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

		let usable: ResolvedFeature[] = [];
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

		let changed = true;
		while (changed) {
			const ids = new Set(usable.map((feature) => feature.id));
			const kept: ResolvedFeature[] = [];
			for (const feature of usable) {
				const missing = feature.entry.requires.find(
					(requirement) => !ids.has(requirement),
				);
				if (missing === undefined) {
					kept.push(feature);
				} else {
					yield* skip(feature.id, `missing_requirement requirement=${missing}`);
				}
			}
			changed = kept.length !== usable.length;
			usable = kept;
		}

		return usable;
	});
