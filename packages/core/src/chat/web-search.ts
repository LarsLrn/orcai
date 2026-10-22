import type { ProviderKind } from "../constants/providers";
import { hasNativeWebSearch } from "../constants/providers";
import type { ProviderId } from "../ids";

/** The organisation setting: no search, the model's own, or a search provider. */
export const webSearchModes = [
	"off",
	"native",
	"provider",
] as const;

export type WebSearchMode = (typeof webSearchModes)[number];

/** How a turn with web search enabled searches, or why it cannot. */
export type WebSearchSource =
	| {
			kind: "native";
	  }
	| {
			kind: "provider";
			providerId: ProviderId;
	  }
	| {
			kind: "none";
			/** Search is off, or the setting is model native and the model has none. */
			reason: "off" | "model";
	  };

export const webSearchSource = ({
	mode,
	providerId,
	modelKind,
}: {
	mode: WebSearchMode;
	providerId: ProviderId | null;
	/** Null while the model is unknown; only model native depends on it. */
	modelKind: ProviderKind | null;
}): WebSearchSource => {
	switch (mode) {
		case "off":
			return {
				kind: "none",
				reason: "off",
			};
		case "native":
			return modelKind !== null && hasNativeWebSearch(modelKind)
				? {
						kind: "native",
					}
				: {
						kind: "none",
						reason: "model",
					};
		case "provider":
			return providerId === null
				? {
						kind: "none",
						reason: "off",
					}
				: {
						kind: "provider",
						providerId,
					};
	}
};
