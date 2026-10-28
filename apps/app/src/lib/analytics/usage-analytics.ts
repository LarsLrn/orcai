import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	AnalyticsCost,
	AnalyticsDays,
	AnalyticsDayUsage,
	AnalyticsUsage,
	ChatMessageRating,
	InstanceAnalytics,
	OrganizationAnalytics,
	UsageBot,
} from "@orcai/schema";
import type { SpiceDbService } from "@orcai/spice-db";
import { and, count, eq, gte, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { usageIdentities } from "./usage-identities";

const DAY_MS = 86_400_000;

const event = dbSchema.quotaUsageEvent;

const total = (column: AnyPgColumn) =>
	sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/** Usage of one currency's events; group by the currency too and add the rows up with `byKey`. */
const usage = {
	inputTokens: total(event.inputTokens),
	outputTokens: total(event.outputTokens),
	totalTokens: total(event.totalTokens),
	cacheReadTokens: total(event.cacheReadTokens),
	cacheWriteTokens: total(event.cacheWriteTokens),
	requests: total(event.requestCount),
	unpriced: sql<number>`count(*) filter (where ${event.cost} is null)`.mapWith(
		Number,
	),
	currency: event.currency,
	amount: total(event.cost),
};

type UsageRow = {
	[Key in keyof typeof usage]: Key extends "currency" ? string | null : number;
};

const day = sql<string>`to_char(date_trunc('day', ${event.occurredAt}), 'YYYY-MM-DD')`;

const NO_USAGE: AnalyticsUsage = {
	inputTokens: 0,
	outputTokens: 0,
	totalTokens: 0,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
	requests: 0,
	cost: [],
	unpriced: 0,
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

/** Costs added per currency, ordered by code. */
const addCosts = (a: AnalyticsCost[], b: AnalyticsCost[]): AnalyticsCost[] => {
	const amounts = new Map(
		a.map(({ currency, amount }) => [
			currency,
			amount,
		]),
	);
	for (const { currency, amount } of b) {
		amounts.set(currency, (amounts.get(currency) ?? 0) + amount);
	}
	return [
		...amounts,
	]
		.map(([currency, amount]) => ({
			currency,
			amount,
		}))
		.sort((x, y) => x.currency.localeCompare(y.currency));
};

const addUsage = (a: AnalyticsUsage, b: AnalyticsUsage): AnalyticsUsage => ({
	inputTokens: a.inputTokens + b.inputTokens,
	outputTokens: a.outputTokens + b.outputTokens,
	totalTokens: a.totalTokens + b.totalTokens,
	cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
	cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
	requests: a.requests + b.requests,
	cost: addCosts(a.cost, b.cost),
	unpriced: a.unpriced + b.unpriced,
});

const sumUsage = (rows: readonly AnalyticsUsage[]): AnalyticsUsage =>
	rows.reduce(addUsage, NO_USAGE);

/** One row per key, with the usage of its currencies' rows added up. */
const byKey = <Row extends UsageRow>(
	rows: readonly Row[],
	key: (row: Row) => string | null,
) => {
	const groups = new Map<
		string | null,
		{
			row: Row;
			usage: AnalyticsUsage;
		}
	>();
	for (const row of rows) {
		const {
			inputTokens,
			outputTokens,
			totalTokens,
			cacheReadTokens,
			cacheWriteTokens,
			requests,
			unpriced,
			currency,
			amount,
		} = row;
		const rowUsage: AnalyticsUsage = {
			inputTokens,
			outputTokens,
			totalTokens,
			cacheReadTokens,
			cacheWriteTokens,
			requests,
			unpriced,
			cost:
				currency === null
					? []
					: [
							{
								currency,
								amount,
							},
						],
		};
		const group = groups.get(key(row));
		groups.set(key(row), {
			row: group?.row ?? row,
			usage: group ? addUsage(group.usage, rowUsage) : rowUsage,
		});
	}
	return [
		...groups.values(),
	].map(({ row, usage: rowUsage }) => {
		const { currency: _currency, amount: _amount, ...fields } = row;
		return {
			...fields,
			...rowUsage,
		};
	});
};

/** Most tokens first, then most requests. */
const byUsage = (a: AnalyticsUsage, b: AnalyticsUsage) =>
	b.totalTokens - a.totalTokens || b.requests - a.requests;

const botKey = (bot: UsageBot) => (bot.kind === "bot" ? bot.id : bot.kind);

/** Rating rows of one bot each, every rating counted, the most rated first. */
const ratingsByBot = (
	rows: ReadonlyArray<{
		bot: UsageBot;
		rating: ChatMessageRating;
		count: number;
	}>,
) => {
	const bots = new Map<
		string,
		{
			bot: UsageBot;
			counts: Record<ChatMessageRating, number>;
		}
	>();
	for (const row of rows) {
		const bot = bots.get(botKey(row.bot)) ?? {
			bot: row.bot,
			counts: {
				very_much: 0,
				a_bit: 0,
				not_really: 0,
				not_at_all: 0,
			},
		};
		bot.counts[row.rating] += row.count;
		bots.set(botKey(row.bot), bot);
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
			.groupBy(day, event.currency);
		const daily = fillDays(
			from,
			days,
			byKey(rows, (row) => row.date),
		);
		return {
			days,
			from,
			daily,
			totals: sumUsage(daily),
		};
	});

/**
 * The organisation's metered usage per UTC day, person, bot and model, and the
 * ratings of its replies per bot, over the last `days` days. Only current
 * members and bots the viewer can read are named; former members and the
 * other bots each add up to one row.
 */
export const organizationAnalytics = ({
	organizationId,
	days,
	viewer,
}: {
	organizationId: OrganizationId;
	days: AnalyticsDays;
	viewer: {
		userId: UserId;
		zedToken?: string;
	};
}): Effect.Effect<OrganizationAnalytics, unknown, DB | SpiceDbService> =>
	Effect.gen(function* () {
		const db = yield* DB;
		const from = yield* range(days);
		const where = finalizedSince(
			from,
			eq(event.organizationId, organizationId),
		);
		const { provider, model, chat, chatMessage, chatMessageRating } = dbSchema;

		const [timeline, users, bots, models, ratings] = yield* Effect.all(
			[
				dailyUsage(from, days, eq(event.organizationId, organizationId)),
				db
					.select({
						userId: event.userId,
						...usage,
					})
					.from(event)
					.where(where)
					.groupBy(event.userId, event.currency),
				db
					.select({
						botId: event.botId,
						...usage,
					})
					.from(event)
					.where(where)
					.groupBy(event.botId, event.currency),
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
					.groupBy(
						event.providerId,
						provider.name,
						model.id,
						model.name,
						event.currency,
					),
				// A reply belongs to the organisation that metered it, whose request id is the reply's id.
				db
					.select({
						botId: chat.botId,
						rating: chatMessageRating.rating,
						count: count(),
					})
					.from(chatMessageRating)
					.innerJoin(
						chatMessage,
						eq(chatMessage.id, chatMessageRating.messageId),
					)
					.innerJoin(chat, eq(chat.id, chatMessage.chatId))
					.where(
						and(
							gte(chatMessageRating.updatedAt, from),
							sql`exists (select 1 from ${event} where ${event.appRequestId} = ${chatMessageRating.messageId}::text and ${event.organizationId} = ${organizationId})`,
						),
					)
					.groupBy(chat.botId, chatMessageRating.rating),
			],
			{
				concurrency: "unbounded",
			},
		);

		const identities = yield* usageIdentities({
			organizationId,
			viewer,
			userIds: users.map(({ userId }) => userId),
			botIds: [
				...bots,
				...ratings,
			].map(({ botId }) => botId),
		});

		return {
			...timeline,
			users: byKey(
				users.map(({ userId, ...row }) => ({
					...row,
					user: identities.person(userId),
				})),
				(row) => (row.user.kind === "member" ? row.user.id : "former"),
			).sort(byUsage),
			bots: byKey(
				bots.map(({ botId, ...row }) => ({
					...row,
					bot: identities.bot(botId),
				})),
				(row) => botKey(row.bot),
			).sort(byUsage),
			models: byKey(models, (row) => `${row.providerId}:${row.modelId}`).sort(
				byUsage,
			),
			ratings: ratingsByBot(
				ratings.map(({ botId, ...row }) => ({
					...row,
					bot: identities.bot(botId),
				})),
			),
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

		const [timeline, organizations, used, active] = yield* Effect.all(
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
						...usage,
					})
					.from(event)
					.where(finalizedSince(from))
					.groupBy(event.organizationId, event.currency),
				db
					.select({
						organizationId: event.organizationId,
						activeUsers: sql<number>`count(distinct ${event.userId})`.mapWith(
							Number,
						),
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
			byKey(used, (row) => row.organizationId).map((row) => [
				row.organizationId,
				row,
			]),
		);
		const activeUsersOf = new Map(
			active.map((row) => [
				row.organizationId,
				row.activeUsers,
			]),
		);
		return {
			...timeline,
			organizations: organizations
				.map((row) => ({
					...row,
					...(usageOf.get(row.organizationId) ?? NO_USAGE),
					activeUsers: activeUsersOf.get(row.organizationId) ?? 0,
				}))
				.sort((a, b) => byUsage(a, b) || a.name.localeCompare(b.name)),
		};
	});
