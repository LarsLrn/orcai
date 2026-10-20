import { z } from "zod/v4";

export const featureIdSchema = z.enum([
	"generativeUi",
]);

export const generativeUiSettingsSchema = z.object({});

/** Enabled features keyed by id; disabling a feature removes its key. */
export const featuresSchema = z.object({
	generativeUi: generativeUiSettingsSchema.optional(),
});

export type FeatureId = z.infer<typeof featureIdSchema>;
export type Features = z.infer<typeof featuresSchema>;

/** Features enabled on new bots and new plain chats. */
export const DEFAULT_FEATURES: Features = {
	generativeUi: {},
};
