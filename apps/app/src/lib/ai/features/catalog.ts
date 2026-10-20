import { type FeatureId, generativeUiSettingsSchema } from "@orcai/schema";
import type { ToolSet } from "ai";
import type { z } from "zod/v4";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import { genUiPrompt } from "@/components/chat/gen-ui/prompt";
import type { ORPCContext } from "@/lib/orpc/implementation/os";

export interface FeatureEntry<Settings extends z.ZodType = z.ZodType> {
	settingsSchema: Settings;
	buildTools(params: {
		context: ORPCContext;
		settings: z.infer<Settings>;
	}): ToolSet;
	/** Appended to the system prompt while the feature is enabled. */
	prompt: string;
	/** Other feature ids that must be enabled too. */
	requires: readonly string[];
}

export type FeatureCatalog = Readonly<Record<string, FeatureEntry>>;

export const featureCatalog = {
	generativeUi: {
		settingsSchema: generativeUiSettingsSchema,
		buildTools: () => buildGenUiTools(),
		prompt: genUiPrompt,
		requires: [],
	},
} satisfies Record<FeatureId, FeatureEntry>;
