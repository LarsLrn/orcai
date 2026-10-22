import { z } from "zod/v4";

export const featureIdSchema = z.enum([
	"generativeUi",
	"webSearch",
]);

export const generativeUiSettingsSchema = z.object({});

/** A host name such as `example.org`; its subdomains count as allowed too. */
export const webSearchDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(253)
	.regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

export const WEB_SEARCH_MAX_ALLOWED_DOMAINS = 50;

export const webSearchSettingsSchema = z.object({
	/** Empty searches the whole web. */
	allowedDomains: z
		.array(webSearchDomainSchema)
		.max(WEB_SEARCH_MAX_ALLOWED_DOMAINS)
		.default([]),
});

/** Enabled features keyed by id; disabling a feature removes its key. */
export const featuresSchema = z.object({
	generativeUi: generativeUiSettingsSchema
		.optional()
		.describe("Shows structured results such as checklists in the answer."),
	webSearch: webSearchSettingsSchema
		.optional()
		.describe(
			"Searches the web as the organisation's web search setting allows. allowedDomains limits it to those host names and their subdomains; empty searches the whole web.",
		),
});

/** What a plain chat may enable; web search is for bots only. */
export const chatFeaturesSchema = featuresSchema.pick({
	generativeUi: true,
});

export const CHAT_FEATURE_IDS = Object.keys(
	chatFeaturesSchema.shape,
) as (keyof typeof chatFeaturesSchema.shape)[];

export type FeatureId = z.infer<typeof featureIdSchema>;
export type Features = z.infer<typeof featuresSchema>;
export type WebSearchSettings = z.infer<typeof webSearchSettingsSchema>;

/** Features enabled on new bots and new plain chats. */
export const DEFAULT_FEATURES: Features = {
	generativeUi: {},
};

/** The settings a feature starts with when it is switched on. */
export const INITIAL_FEATURE_SETTINGS = {
	generativeUi: {},
	webSearch: {
		allowedDomains: [],
	},
} satisfies Required<Features>;
