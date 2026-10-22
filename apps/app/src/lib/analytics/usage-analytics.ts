import type { OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	AnalyticsDays,
	AnalyticsDayUsage,
	AnalyticsUsage,
	ChatMessageRating,
	InstanceAnalytics,
	OrganizationAnalytics,
} from "@orcai/schema";
import { and, count, eq, gte, type SQL, sql } from "drizzle-orm";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";

const DAY_MS = 86_400_000;

const event = dbSchema.quotaUsageEvent;

const usage = {
	inputTokens: sql<number>`coalesce(sum(${event.inputTokens}), 0)`.mapWith(
		Number,
	),
	outputTokens: sql<number>`coalesce(sum(${event.outputTokens}), 0)`.mapWith(
		Number,
	),
	totalTokens: sql<number>`coalesce(sum(${event.totalTokens}), 0)`.mapWith(
		Number,
	),
	requests: sql<number>`coalesce(sum(${event.requestCount}), 0)`.mapWith(
		Number,
	),
};

const day = sql<string>`to_char(date_trunc('day', ${event.occurredAt}), 'YYYY-MM-DD')`;

const NO_USAGE: AnalyticsUsage = {
	inputTokens: 0,
	outputTokens: 0,
	totalTokens: 0,
	requests: 0,
};

/** The start of the UTC day `days - 1` days before `now`. */
const rangeStart = (days: AnalyticsDays, now: number) =>
	new Date(Math.floor(now / DAY_MS) * DAY_MS - (days - 1) * DAY_MS);

/** One entry per day from `from` on, zero where `rows` has none. */
const fillDays = (
	from: Date,
	days: AnalyticsDays,
	rows: readonly AnalyticsDayUsage[],
): AnalyticsDayUsage[] => {
	const byDate = new Map(
		rows.map((row) => [
			row.date,
			row,
		]),
	);
	return Array.from(
		{
			length: days,
		},
		(_, index) => {
			const date = new Date(from.getTime() + index * DAY_MS)
				.toISOString()
				.slice(0, 10);
			return (
				byDate.get(date) ?? {
					date,
					...NO_USAGE,
				}
			);
		},
	);
};

const sumUsage = (rows: readonly AnalyticsUsage[]): AnalyticsUsage =>
	rows.reduce(
		(sum, row) => ({
			inputTokens: sum.inputTokens + row.inputTokens,
			outputTokens: sum.outputTokens + row.outputTokens,
			totalTokens: sum.totalTokens + row.totalTokens,
			requests: sum.requests + row.requests,
		}),
		NO_USAGE,
	);

/** Most tokens first, then most requests. */
const byUsage = (a: AnalyticsUsage, b: AnalyticsUsage) =>
	b.totalTokens - a.totalTokens || b.requests - a.requests;

/** Rating rows of one bot each, every rating counted, the most rated first. */
const ratingsByBot = <Bot extends string | null>(
	rows: ReadonlyArray<{
		botId: Bot;
		name: string | null;
		rating: ChatMessageRating;
		count: number;
	}>,
) => {
	const bots = new Map<
		Bot,
		{
			botId: Bot;
			name: string | null;
			counts: Record<ChatMessageRating, number>;
		}
	>();
	for (const row of rows) {
		const bot = bots.get(row.botId) ?? {
			botId: row.botId,
			name: row.name,
			counts: {
				very_much: 0,
				a_bit: 0,
				not_really: 0,
				not_at_all: 0,
			},
		};
		bot.counts[row.rating] += row.count;
		bots.set(row.botId, bot);
	}
	const total = (counts: Record<ChatMessageRating, number>) =>
		Object.values(counts).reduce((sum, value) => sum + value, 0);
	return [
		...bots.values(),
	].sort((a, b) => total(b.counts) - total(a.counts));
};

const range = (days: AnalyticsDays) =>
	Clock.currentTimeMillis.pipe(Effect.map((now) => rangeStart(days, now)));

const finalizedSince = (from: Date, scope?: SQL) =>
	and(eq(event.eventType, "finalized"), gte(event.occurredAt, from), scope);

const dailyUsage = (from: Date, days: AnalyticsDays, scope?: SQL) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.select({
				date: day,
				...usage,
			})
			.from(event)
			.where(finalizedSince(from, scope))
			.groupBy(day);
		const daily = fillDays(from, days, rows);
		return {
			days,
			from,
			daily,
			totals: sumUsage(daily),
		};
	});

/**
 * The organisation's metered usage per UTC day, person, bot and model, and the
 * ratings of its replies per bot, over the last `days` days.
 */
export const organizationAnalytics = ({
	organizationId,
	days,
}: {
	organizationId: OrganizationId;
	days: AnalyticsDays;
}): Effect.Effect<OrganizationAnalytics, unknown, DB> =>
	Effect.gen(function* () {
		const db = yield* DB;
		const from = yield* range(days);
		const where = finalizedSince(
			from,
			eq(event.organizationId, organizationId),
		);
		const { user, bot, provider, model, chat, chatMessage, chatMessageRating } =
			dbSchema;

		const [timeline, users, bots, models, ratings] = yield* Effect.all(
			[
				dailyUsage(from, days, eq(event.organizationId, organizationId)),
				db
					.select({
						userId: event.userId,
						name: user.name,
						email: user.email,
						...usage,
					})
					.from(event)
					.innerJoin(user, eq(user.id, event.userId))
					.where(where)
					.groupBy(event.userId, user.name, user.email),
				db
					.select({
						botId: event.botId,
						name: bot.name,
						...usage,
					})
					.from(event)
					.leftJoin(bot, eq(bot.id, event.botId))
					.where(where)
					.groupBy(event.botId, bot.name),
				db
					.select({
						providerId: event.providerId,
						providerName: provider.name,
						modelId: model.id,
						modelName: model.name,
						...usage,
					})
					.from(event)
					.innerJoin(provider, eq(provider.id, event.providerId))
					.leftJoin(model, eq(model.id, event.modelId))
					.where(where)
					.groupBy(event.providerId, provider.name, model.id, model.name),
				// A reply belongs to the organisation that metered it, whose request id is the reply's id.
				db
					.select({
						botId: chat.botId,
						name: bot.name,
						rating: chatMessageRating.rating,
						count: count(),
					})
					.from(chatMessageRating)
					.innerJoin(
						chatMessage,
						eq(chatMessage.id, chatMessageRating.messageId),
					)
					.innerJoin(chat, eq(chat.id, chatMessage.chatId))
					.leftJoin(bot, eq(bot.id, chat.botId))
					.where(
						and(
							gte(chatMessageRating.updatedAt, from),
							sql`exists (select 1 from ${event} where ${event.appRequestId} = ${chatMessageRating.messageId}::text and ${event.organizationId} = ${organizationId})`,
						),
					)
					.groupBy(chat.botId, bot.name, chatMessageRating.rating),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			...timeline,
			users: users.sort(byUsage),
			bots: bots.sort(byUsage),
			models: models.sort(byUsage),
			ratings: ratingsByBot(ratings),
		};
	});

/** Every organisation's metered usage, and the instance's per UTC day, over the last `days` days. */
export const instanceAnalytics = ({
	days,
}: {
	days: AnalyticsDays;
}): Effect.Effect<InstanceAnalytics, unknown, DB> =>
	Effect.gen(function* () {
		const db = yield* DB;
		const from = yield* range(days);
		const { organization } = dbSchema;

		const [timeline, organizations, used] = yield* Effect.all(
			[
				dailyUsage(from, days),
				db
					.select({
						organizationId: organization.id,
						name: organization.name,
						slug: organization.slug,
					})
					.from(organization),
				db
					.select({
						organizationId: event.organizationId,
						activeUsers: sql<number>`count(distinct ${event.userId})`.mapWith(
							Number,
						),
						...usage,
					})
					.from(event)
					.where(finalizedSince(from))
					.groupBy(event.organizationId),
			],
			{
				concurrency: "unbounded",
			},
		);

		const usageOf = new Map(
			used.map((row) => [
				row.organizationId,
				row,
			]),
		);
		return {
			...timeline,
			organizations: organizations
				.map((row) => ({
					...row,
					...(usageOf.get(row.organizationId) ?? {
						...NO_USAGE,
						activeUsers: 0,
					}),
				}))
				.sort((a, b) => byUsage(a, b) || a.name.localeCompare(b.name)),
		};
	});
