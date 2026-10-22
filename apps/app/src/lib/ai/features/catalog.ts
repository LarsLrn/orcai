import {
	type FeatureId,
	generativeUiSettingsSchema,
	webSearchSettingsSchema,
} from "@orcai/schema";
import type { ToolSet } from "ai";
import type { z } from "zod/v4";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import { genUiPrompt } from "@/components/chat/gen-ui/prompt";
import {
	buildWebSearchTools,
	type TurnWebSearch,
} from "@/lib/ai/tools/web/toolset";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

/** What the turn offers features beyond their settings. */
interface FeatureTurn {
	webSearch: TurnWebSearch;
}

export interface FeatureEntry<Settings extends z.ZodType = z.ZodType> {
	settingsSchema: Settings;
	buildTools(params: {
		context: ORPCContext;
		settings: z.infer<Settings>;
		turn: FeatureTurn;
	}): ToolSet;
	/** Appended to the system prompt while the feature is enabled. */
	prompt: string;
	/** Other feature ids that must be enabled too. */
	requires: readonly string[];
}

export type FeatureCatalog = Readonly<Record<string, FeatureEntry>>;

/** An entry whose tools read its own settings, which resolving has already parsed with its schema. */
const feature = <Settings extends z.ZodType>(
	entry: FeatureEntry<Settings>,
): FeatureEntry => entry as unknown as FeatureEntry;

export const featureCatalog = {
	generativeUi: {
		settingsSchema: generativeUiSettingsSchema,
		buildTools: () => buildGenUiTools(),
		prompt: genUiPrompt,
		requires: [],
	},
	webSearch: feature({
		settingsSchema: webSearchSettingsSchema,
		// Each search tool describes itself, so a turn without one reads nothing about search.
		buildTools: ({ settings, turn }) =>
			buildWebSearchTools({
				webSearch: turn.webSearch,
				allowedDomains: settings.allowedDomains,
			}),
		prompt: "",
		requires: [],
	}),
} satisfies Record<FeatureId, FeatureEntry>;
