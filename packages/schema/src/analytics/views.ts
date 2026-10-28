import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { chatMessageRatingSchema } from "../chat-message/schema";
import { modelIdSchema } from "../model/ref";
import { organizationIdSchema } from "../organization/ref";
import { providerIdSchema } from "../provider/ref";
import { userIdSchema } from "../user/ref";
import { analyticsDaysSchema } from "./inputs";

/** An estimated cost in one currency; amounts in different currencies are never added up. */
export const analyticsCostSchema = z.object({
	currency: z.string(),
	/** In micro-units of the currency. */
	amount: z.number(),
});

/** Tokens and provider requests as metered; the two units are never added up. */
export const analyticsUsageSchema = z.object({
	inputTokens: z.number(),
	outputTokens: z.number(),
	totalTokens: z.number(),
	cacheReadTokens: z.number(),
	cacheWriteTokens: z.number(),
	requests: z.number(),
	/** One entry per currency, ordered by code. */
	cost: z.array(analyticsCostSchema),
	/** Metered calls without a price, whose cost is unknown. */
	unpriced: z.number(),
});

export const analyticsDayUsageSchema = analyticsUsageSchema.extend({
	/** The UTC day, `YYYY-MM-DD`. */
	date: z.iso.date(),
});

const analyticsRangeShape = {
	days: analyticsDaysSchema,
	/** The start of the range's first UTC day. */
	from: z.coerce.date(),
	/** Every day of the range, oldest first, zero when nothing was used. */
	daily: z.array(analyticsDayUsageSchema),
	totals: analyticsUsageSchema,
};

/** A current member, or everyone who has left the organisation added up. */
export const analyticsPersonSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("member"),
		id: userIdSchema,
		name: z.string(),
		email: z.string(),
	}),
	z.object({
		kind: z.literal("former"),
	}),
]);

/**
 * A bot the viewer can read, usage outside bot chats or before bots were
 * recorded, or every bot the viewer cannot read added up.
 */
export const analyticsBotSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("bot"),
		id: botIdSchema,
		name: z.string(),
	}),
	z.object({
		kind: z.literal("none"),
	}),
	z.object({
		kind: z.literal("other"),
	}),
]);

export const organizationAnalyticsSchema = z.object({
	...analyticsRangeShape,
	users: z.array(
		analyticsUsageSchema.extend({
			user: analyticsPersonSchema,
		}),
	),
	bots: z.array(
		analyticsUsageSchema.extend({
			bot: analyticsBotSchema,
		}),
	),
	/** A null model was not recorded or has been deleted. */
	models: z.array(
		analyticsUsageSchema.extend({
			providerId: providerIdSchema,
			providerName: z.string(),
			modelId: modelIdSchema.nullable(),
			modelName: z.string().nullable(),
		}),
	),
	/** Ratings of the organisation's replies, by the bot of their chat. */
	ratings: z.array(
		z.object({
			bot: analyticsBotSchema,
			counts: z.record(chatMessageRatingSchema, z.number()),
		}),
	),
});

export const instanceAnalyticsSchema = z.object({
	...analyticsRangeShape,
	organizations: z.array(
		analyticsUsageSchema.extend({
			organizationId: organizationIdSchema,
			name: z.string(),
			slug: z.string(),
			/** People with metered usage in the range. */
			activeUsers: z.number(),
		}),
	),
});

export type AnalyticsCost = z.infer<typeof analyticsCostSchema>;
export type AnalyticsUsage = z.infer<typeof analyticsUsageSchema>;
export type AnalyticsDayUsage = z.infer<typeof analyticsDayUsageSchema>;
export type AnalyticsPerson = z.infer<typeof analyticsPersonSchema>;
export type AnalyticsBot = z.infer<typeof analyticsBotSchema>;
export type OrganizationAnalytics = z.infer<typeof organizationAnalyticsSchema>;
export type InstanceAnalytics = z.infer<typeof instanceAnalyticsSchema>;
