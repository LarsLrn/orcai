import { describe, expect, test } from "bun:test";
import { type MeterStep, startMeteredCall } from "@orcai/ai";
import type {
	BotId,
	ChatId,
	ChatMessageId,
	OrganizationId,
	OrganizationRole,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	AnalyticsDays,
	ChatMessageRating,
	ModelPrices,
	OrganizationAnalytics,
} from "@orcai/schema";
import { createOrganization, createUser } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { removeMembers } from "@/lib/authz/organization-membership";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, signIn, procedureOptions, instanceAdmin } = authzIntegration();

/** The newest zedToken any call returned; every call reads at least at it. */
let token: string | undefined;
const options = (actor: Actor) => procedureOptions(actor, token);
const track = <
	A extends {
		meta?: {
			zedToken?: string;
		};
	},
>(
	output: A,
) => {
	token = output.meta?.zedToken ?? token;
	return output;
};

const DAY_MS = 86_400_000;

const usage = (inputTokens: number, outputTokens: number): MeterStep => ({
	usage: {
		inputTokens,
		inputTokenDetails: {
			noCacheTokens: inputTokens,
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
		},
		outputTokens,
		outputTokenDetails: {
			textTokens: outputTokens,
			reasoningTokens: undefined,
		},
		totalTokens: inputTokens + outputTokens,
	},
	toolCalls: [],
});

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/**
 * An organisation with an admin and a member, a provider with one model, and a
 * pool for everyone. People `joining` from other organisations come back as
 * `joined`, signed in to this one.
 */
const meteredOrganization = async (
	setup: {
		pricing?: {
			currency?: string;
			prices?: Partial<ModelPrices>;
		};
		joining?: ReadonlyArray<{
			actor: Actor;
			role: OrganizationRole;
		}>;
	} = {},
) => {
	const users = await Promise.all([
		run(createUser()),
		run(createUser()),
	]);
	const joining = setup.joining ?? [];
	const { organization, zedToken } = await run(
		createOrganization({
			members: [
				{
					userId: users[0].id,
					role: "admin",
				},
				{
					userId: users[1].id,
					role: "member",
				},
				...joining.map(({ actor, role }) => ({
					userId: actor.user.id,
					role,
				})),
			],
		}),
	);
	const organizationId = organization.id;
	token = zedToken ?? token;
	const [admin, member, ...joined] = await Promise.all(
		[
			...users.map((user) => user.id),
			...joining.map(({ actor }) => actor.user.id),
		].map((userId) => signIn(organizationId, userId)),
	);
	const procedures = await run(Procedures);
	const asAdmin = () => options(admin);
	const [allMembers] = await run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.group)
				.values({
					organizationId,
					name: "All Members",
					kind: "system",
					systemKey: "all_members",
					createdBy: admin.user.id,
				})
				.returning();
		}),
	);
	/** A provider with one model and a pool for everyone; prices are in its currency. */
	const addModel = async (pricing: {
		currency?: string;
		prices?: Partial<ModelPrices>;
	}) => {
		const { data: provider } = track(
			await run(
				procedures.provider.create(
					{
						name: `Analytics ${crypto.randomUUID()}`,
						description: "Metered by the analytics test.",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: "tokens",
						currency: pricing.currency,
						enabled: true,
					},
					await asAdmin(),
				),
			),
		);
		const { data: model } = await run(
			procedures.model.create(
				{
					providerId: provider.id,
					providerModelId: "analytics-model",
					name: "Analytics model",
					description: "A text model.",
					isDeprecated: false,
					capabilities: [
						"text",
					],
					prices: pricing.prices,
				},
				await asAdmin(),
			),
		);
		await run(
			procedures.quota.create(
				{
					name: `Analytics ${crypto.randomUUID()}`,
					providerId: provider.id,
					periodType: "monthly",
					budgetAmount: 1_000_000,
					groupIds: [
						allMembers.id,
					],
				},
				await asAdmin(),
			),
		);
		return {
			providerId: provider.id,
			modelId: model.id,
		};
	};
	const model = await addModel(setup.pricing ?? {});

	/** Meters one finished call and returns its request id, which a reply would carry. */
	const meter = async (params: {
		actor: Actor;
		botId?: BotId;
		steps: MeterStep[];
		daysAgo?: number;
		/** Another of the organisation's models, from `addModel`. */
		on?: Awaited<ReturnType<typeof addModel>>;
	}) => {
		const appRequestId = crypto.randomUUID();
		await run(
			Effect.gen(function* () {
				const meter = yield* startMeteredCall({
					appRequestId,
					organizationId,
					userId: params.actor.user.id,
					...(params.on ?? model),
					botId: params.botId,
					maxSteps: params.steps.length,
					messages: [],
				});
				for (const step of params.steps) meter.step(step);
				yield* meter.settle("completed");
				if (params.daysAgo) {
					yield* (yield* DB)
						.update(dbSchema.quotaUsageEvent)
						.set({
							occurredAt: new Date(Date.now() - params.daysAgo * DAY_MS),
						})
						.where(eq(dbSchema.quotaUsageEvent.appRequestId, appRequestId));
				}
			}),
		);
		return appRequestId as ChatMessageId;
	};

	const analytics = async (actor: Actor, days: AnalyticsDays) =>
		run(
			procedures.analytics.organization(
				{
					days,
				},
				await options(actor),
			),
		).then(({ data }) => data);

	const setPrices = async (prices: Partial<ModelPrices>) =>
		run(
			procedures.model.update(
				{
					id: model.modelId,
					prices,
				},
				await asAdmin(),
			),
		);

	return {
		organizationId,
		admin,
		member,
		joined,
		...model,
		addModel,
		meter,
		setPrices,
		analytics,
		procedures,
	};
};

const finalizedEvent = (appRequestId: string) =>
	run(
		Effect.gen(function* () {
			const event = dbSchema.quotaUsageEvent;
			const [row] = yield* (yield* DB)
				.select({
					cost: event.cost,
					currency: event.currency,
					costSource: event.costSource,
				})
				.from(event)
				.where(
					and(
						eq(event.appRequestId, appRequestId),
						eq(event.eventType, "finalized"),
					),
				);
			return row;
		}),
	);

/** A draft bot of `owner`, readable by its owner alone. */
const createBot = async (owner: Actor) => {
	const procedures = await run(Procedures);
	const name = `Analytics bot ${crypto.randomUUID()}`;
	const { data } = track(
		await run(
			procedures.bot.save(
				{
					name,
					description: "Metered by the analytics test.",
					status: "draft",
				},
				await options(owner),
			),
		),
	);
	return {
		id: data.id,
		name,
	};
};

const viewerOf = (botId: BotId, viewer: Actor) => ({
	resourceType: "bot" as const,
	resourceId: botId,
	principalType: "user" as const,
	principalId: viewer.user.id,
});

const share = async (owner: Actor, botId: BotId, viewer: Actor) => {
	const procedures = await run(Procedures);
	track(
		await run(
			procedures.resource.grant(
				{
					resourceType: "bot",
					resourceId: botId,
					principals: [
						{
							principalType: "user",
							principalId: viewer.user.id,
						},
					],
					role: "viewer",
				},
				await options(owner),
			),
		),
	);
};

const unshare = async (owner: Actor, botId: BotId, viewer: Actor) => {
	const procedures = await run(Procedures);
	track(
		await run(
			procedures.resource.revoke(viewerOf(botId, viewer), await options(owner)),
		),
	);
};

/** A reply under `messageId` in a chat of `rater` with `botId`, rated `rating`. */
const rateReply = (params: {
	rater: Actor;
	botId: BotId | null;
	messageId: ChatMessageId;
	rating: ChatMessageRating;
}) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [chat] = yield* db
				.insert(dbSchema.chat)
				.values({
					id: crypto.randomUUID() as ChatId,
					userId: params.rater.user.id,
					botId: params.botId,
					organizationId: params.rater.session
						.activeOrganizationId as OrganizationId,
				})
				.returning();
			yield* db.insert(dbSchema.chatMessage).values({
				id: params.messageId,
				chatId: chat.id,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: "Answer",
					},
				],
				attachments: [],
				metadata: {},
				position: 0,
			});
			yield* db.insert(dbSchema.chatMessageRating).values({
				messageId: params.messageId,
				userId: params.rater.user.id,
				rating: params.rating,
			});
		}),
	);

const NO_RATINGS = {
	very_much: 0,
	a_bit: 0,
	not_really: 0,
	not_at_all: 0,
};

describe("organization analytics", () => {
	test(
		"sums the range's finalized usage per day, person, bot and model",
		async () => {
			const org = await meteredOrganization();
			const bot = await createBot(org.member);
			await share(org.member, bot.id, org.admin);
			await org.meter({
				actor: org.member,
				botId: bot.id,
				steps: [
					usage(100, 50),
				],
			});
			await org.meter({
				actor: org.admin,
				steps: [
					usage(4, 1),
					usage(6, 4),
				],
			});
			await org.meter({
				actor: org.member,
				botId: bot.id,
				steps: [
					usage(1000, 1000),
				],
				daysAgo: 10,
			});

			const week = await org.analytics(org.admin, 7);

			const today = new Date().toISOString().slice(0, 10);
			expect(week.daily).toHaveLength(7);
			expect(week.daily.at(-1)).toEqual({
				date: today,
				inputTokens: 110,
				outputTokens: 55,
				totalTokens: 165,
				requests: 3,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				cost: [],
				unpriced: 2,
			});
			expect(week.daily.slice(0, -1).every((day) => day.requests === 0)).toBe(
				true,
			);
			expect(week.from.toISOString()).toBe(
				`${week.daily[0].date}T00:00:00.000Z`,
			);
			expect(week.totals).toEqual({
				inputTokens: 110,
				outputTokens: 55,
				totalTokens: 165,
				requests: 3,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				cost: [],
				unpriced: 2,
			});
			expect(week.users).toEqual([
				{
					user: {
						kind: "member",
						id: org.member.user.id,
						name: org.member.user.name,
						email: org.member.user.email,
					},
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
					requests: 1,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cost: [],
					unpriced: 1,
				},
				{
					user: {
						kind: "member",
						id: org.admin.user.id,
						name: org.admin.user.name,
						email: org.admin.user.email,
					},
					inputTokens: 10,
					outputTokens: 5,
					totalTokens: 15,
					requests: 2,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cost: [],
					unpriced: 1,
				},
			]);
			expect(
				week.bots.map(({ bot, totalTokens, requests }) => ({
					bot,
					totalTokens,
					requests,
				})),
			).toEqual([
				{
					bot: {
						kind: "bot",
						id: bot.id,
						name: bot.name,
					},
					totalTokens: 150,
					requests: 1,
				},
				{
					bot: {
						kind: "none",
					},
					totalTokens: 15,
					requests: 2,
				},
			]);
			expect(week.models).toEqual([
				expect.objectContaining({
					providerId: org.providerId,
					modelId: org.modelId,
					modelName: "Analytics model",
					totalTokens: 165,
					requests: 3,
				}),
			]);

			const month = await org.analytics(org.admin, 30);
			expect(month.daily).toHaveLength(30);
			expect(month.totals).toEqual({
				inputTokens: 1110,
				outputTokens: 1055,
				totalTokens: 2165,
				requests: 4,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				cost: [],
				unpriced: 3,
			});
		},
		TIMEOUT,
	);

	test(
		"counts ratings of the organisation's replies per bot",
		async () => {
			const org = await meteredOrganization();
			const other = await meteredOrganization();
			const bot = await createBot(org.member);
			await share(org.member, bot.id, org.admin);

			const ownReply = await org.meter({
				actor: org.member,
				botId: bot.id,
				steps: [
					usage(1, 1),
				],
			});
			const plainReply = await org.meter({
				actor: org.member,
				steps: [
					usage(1, 1),
				],
			});
			const foreignReply = await other.meter({
				actor: other.member,
				steps: [
					usage(1, 1),
				],
			});
			await rateReply({
				rater: org.member,
				botId: bot.id,
				messageId: ownReply,
				rating: "very_much",
			});
			await rateReply({
				rater: org.member,
				botId: null,
				messageId: plainReply,
				rating: "not_really",
			});
			await rateReply({
				rater: org.member,
				botId: bot.id,
				messageId: foreignReply,
				rating: "not_at_all",
			});

			const { ratings } = await org.analytics(org.admin, 7);

			expect(ratings).toHaveLength(2);
			expect(ratings).toContainEqual({
				bot: {
					kind: "bot",
					id: bot.id,
					name: bot.name,
				},
				counts: {
					...NO_RATINGS,
					very_much: 1,
				},
			});
			expect(ratings).toContainEqual({
				bot: {
					kind: "none",
				},
				counts: {
					...NO_RATINGS,
					not_really: 1,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"only the organisation's admins see it, and only their own organisation",
		async () => {
			const org = await meteredOrganization();
			const other = await meteredOrganization();
			await org.meter({
				actor: org.member,
				steps: [
					usage(7, 3),
				],
			});

			expect(await rejection(org.analytics(org.member, 7))).toMatchObject({
				_tag: "ForbiddenError",
			});
			const { users, totals } = await other.analytics(other.admin, 7);
			expect(users).toEqual([]);
			expect(totals.requests).toBe(0);
		},
		TIMEOUT,
	);
});

/** Each bot's tokens and requests, as `bot:<id>` for a named bot, else its kind. */
const botUsage = (bots: OrganizationAnalytics["bots"]) =>
	bots.map(({ bot, totalTokens, requests }) => ({
		bot: bot.kind === "bot" ? `bot:${bot.id}` : bot.kind,
		totalTokens,
		requests,
	}));

describe("organization analytics scope", () => {
	test(
		"names only the bots the viewer can read and adds up the others as other bots",
		async () => {
			const org = await meteredOrganization();
			const own = await createBot(org.admin);
			const shared = await createBot(org.member);
			const secret = await createBot(org.member);
			const alsoSecret = await createBot(org.member);
			await share(org.member, shared.id, org.admin);
			for (const [bot, tokens] of [
				[
					own,
					1,
				],
				[
					shared,
					2,
				],
				[
					secret,
					3,
				],
				[
					alsoSecret,
					4,
				],
			] as const) {
				await rateReply({
					rater: org.member,
					botId: bot.id,
					messageId: await org.meter({
						actor: org.member,
						botId: bot.id,
						steps: [
							usage(tokens, tokens),
						],
					}),
					rating: "very_much",
				});
			}

			const analytics = await org.analytics(org.admin, 7);

			const response = JSON.stringify(analytics);
			for (const hidden of [
				secret,
				alsoSecret,
			]) {
				expect(response).not.toContain(hidden.id);
				expect(response).not.toContain(hidden.name);
			}
			expect(botUsage(analytics.bots)).toEqual([
				{
					bot: "other",
					totalTokens: 14,
					requests: 2,
				},
				{
					bot: `bot:${shared.id}`,
					totalTokens: 4,
					requests: 1,
				},
				{
					bot: `bot:${own.id}`,
					totalTokens: 2,
					requests: 1,
				},
			]);
			expect(analytics.totals.totalTokens).toBe(20);
			expect(analytics.ratings).toHaveLength(3);
			expect(analytics.ratings[0]).toEqual({
				bot: {
					kind: "other",
				},
				counts: {
					...NO_RATINGS,
					very_much: 2,
				},
			});
			for (const bot of [
				shared,
				own,
			]) {
				expect(analytics.ratings).toContainEqual({
					bot: {
						kind: "bot",
						id: bot.id,
						name: bot.name,
					},
					counts: {
						...NO_RATINGS,
						very_much: 1,
					},
				});
			}
		},
		TIMEOUT,
	);

	test(
		"hides a bot again once its grant is revoked",
		async () => {
			const org = await meteredOrganization();
			const bot = await createBot(org.member);
			await share(org.member, bot.id, org.admin);
			await org.meter({
				actor: org.member,
				botId: bot.id,
				steps: [
					usage(5, 5),
				],
			});
			expect(botUsage((await org.analytics(org.admin, 7)).bots)).toEqual([
				{
					bot: `bot:${bot.id}`,
					totalTokens: 10,
					requests: 1,
				},
			]);

			await unshare(org.member, bot.id, org.admin);

			const analytics = await org.analytics(org.admin, 7);
			expect(JSON.stringify(analytics)).not.toContain(bot.name);
			expect(botUsage(analytics.bots)).toEqual([
				{
					bot: "other",
					totalTokens: 10,
					requests: 1,
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"shows each organisation its own usage of a bot used in both, named only where the viewer can read it",
		async () => {
			const first = await meteredOrganization();
			const second = await meteredOrganization({
				joining: [
					{
						actor: first.member,
						role: "member",
					},
				],
			});
			const [owner] = second.joined;
			const bot = await createBot(owner);
			await share(owner, bot.id, second.admin);
			await first.meter({
				actor: first.member,
				botId: bot.id,
				steps: [
					usage(3, 3),
				],
			});
			await second.meter({
				actor: owner,
				botId: bot.id,
				steps: [
					usage(4, 4),
				],
			});

			const firstAnalytics = await first.analytics(first.admin, 7);
			expect(JSON.stringify(firstAnalytics)).not.toContain(bot.name);
			expect(botUsage(firstAnalytics.bots)).toEqual([
				{
					bot: "other",
					totalTokens: 6,
					requests: 1,
				},
			]);
			expect(botUsage((await second.analytics(second.admin, 7)).bots)).toEqual([
				{
					bot: `bot:${bot.id}`,
					totalTokens: 8,
					requests: 1,
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"adds up former members as one row without their current profile",
		async () => {
			const first = await meteredOrganization();
			const second = await meteredOrganization({
				joining: [
					{
						actor: first.member,
						role: "admin",
					},
				],
			});
			const [leaver] = second.joined;
			await first.meter({
				actor: first.member,
				steps: [
					usage(3, 2),
				],
			});
			await first.meter({
				actor: first.admin,
				steps: [
					usage(1, 1),
				],
			});
			await second.meter({
				actor: leaver,
				steps: [
					usage(4, 4),
				],
			});
			expect(await rejection(first.analytics(first.member, 7))).toMatchObject({
				_tag: "ForbiddenError",
			});

			await run(
				removeMembers({
					organizationId: first.organizationId,
					userIds: [
						first.member.user.id,
					],
					actor: {
						kind: "member",
						userId: first.admin.user.id,
					},
				}),
			);
			const renamed = {
				name: `Renamed ${crypto.randomUUID()}`,
				email: `renamed-${crypto.randomUUID()}@example.com`,
			};
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.user)
						.set(renamed)
						.where(eq(dbSchema.user.id, first.member.user.id));
				}),
			);

			const analytics = await first.analytics(first.admin, 7);
			const response = JSON.stringify(analytics);
			expect(response).not.toContain(first.member.user.id);
			expect(response).not.toContain(renamed.name);
			expect(response).not.toContain(renamed.email);
			expect(
				analytics.users.map(({ user, totalTokens }) => ({
					user,
					totalTokens,
				})),
			).toEqual([
				{
					user: {
						kind: "former",
					},
					totalTokens: 5,
				},
				{
					user: {
						kind: "member",
						id: first.admin.user.id,
						name: first.admin.user.name,
						email: first.admin.user.email,
					},
					totalTokens: 2,
				},
			]);
			expect(analytics.totals.totalTokens).toBe(7);

			expect((await second.analytics(leaver, 7)).users).toEqual([
				expect.objectContaining({
					user: {
						kind: "member",
						id: leaver.user.id,
						...renamed,
					},
					totalTokens: 8,
				}),
			]);
		},
		TIMEOUT,
	);
});

describe("usage cost", () => {
	test(
		"is priced at finalize in the provider's currency and kept when prices change",
		async () => {
			const org = await meteredOrganization({
				pricing: {
					currency: "EUR",
					prices: {
						input: 2,
						output: 10,
					},
				},
			});
			const first = await org.meter({
				actor: org.member,
				steps: [
					usage(1_000, 100),
					usage(500, 50),
				],
			});

			await org.setPrices({
				output: 20,
			});
			const second = await org.meter({
				actor: org.member,
				steps: [
					usage(1_000, 100),
				],
			});

			expect(await finalizedEvent(first)).toEqual({
				cost: 4_500,
				currency: "EUR",
				costSource: "estimated",
			});
			expect(await finalizedEvent(second)).toEqual({
				cost: 4_000,
				currency: "EUR",
				costSource: "estimated",
			});
		},
		TIMEOUT,
	);

	test(
		"stays unknown for a model without prices",
		async () => {
			const org = await meteredOrganization();
			const request = await org.meter({
				actor: org.member,
				steps: [
					usage(1_000, 100),
				],
			});

			expect(await finalizedEvent(request)).toEqual({
				cost: null,
				currency: null,
				costSource: null,
			});
		},
		TIMEOUT,
	);
});

describe("cost analytics", () => {
	test(
		"adds cost up per currency and counts calls without a price",
		async () => {
			const org = await meteredOrganization({
				pricing: {
					currency: "EUR",
					prices: {
						input: 2,
						output: 10,
					},
				},
			});
			const dollars = await org.addModel({
				prices: {
					input: 1,
					output: 1,
				},
			});
			const unpriced = await org.addModel({});
			const cached = usage(1_000, 100);
			cached.usage.inputTokenDetails = {
				noCacheTokens: 200,
				cacheReadTokens: 600,
				cacheWriteTokens: 200,
			};
			await org.meter({
				actor: org.member,
				steps: [
					cached,
				],
			});
			await org.meter({
				actor: org.member,
				steps: [
					usage(1_000, 1_000),
				],
				on: dollars,
			});
			await org.meter({
				actor: org.member,
				steps: [
					usage(5, 5),
				],
				on: unpriced,
			});
			const cost = [
				{
					currency: "EUR",
					amount: 3_000,
				},
				{
					currency: "USD",
					amount: 2_000,
				},
			];

			const { totals, daily, users, models } = await org.analytics(
				org.admin,
				7,
			);

			expect(totals).toMatchObject({
				cacheReadTokens: 600,
				cacheWriteTokens: 200,
				cost,
				unpriced: 1,
			});
			expect(daily.at(-1)).toMatchObject({
				cost,
				unpriced: 1,
			});
			expect(users).toEqual([
				expect.objectContaining({
					user: expect.objectContaining({
						id: org.member.user.id,
					}),
					cost,
					unpriced: 1,
				}),
			]);
			expect(
				models.map(({ providerId, cost, unpriced }) => ({
					providerId,
					cost,
					unpriced,
				})),
			).toEqual(
				expect.arrayContaining([
					{
						providerId: org.providerId,
						cost: [
							cost[0],
						],
						unpriced: 0,
					},
					{
						providerId: dollars.providerId,
						cost: [
							cost[1],
						],
						unpriced: 0,
					},
					{
						providerId: unpriced.providerId,
						cost: [],
						unpriced: 1,
					},
				]),
			);

			const { organizations } = await run(
				org.procedures.analytics.instance(
					{
						days: 7,
					},
					await procedureOptions(await instanceAdmin(org.organizationId)),
				),
			).then(({ data }) => data);
			expect(
				organizations.find(
					({ organizationId }) => organizationId === org.organizationId,
				),
			).toMatchObject({
				cost,
				unpriced: 1,
				requests: 3,
				activeUsers: 1,
			});
		},
		TIMEOUT,
	);
});

describe("instance analytics", () => {
	test(
		"lists every organisation's totals to instance admins only",
		async () => {
			const org = await meteredOrganization();
			const idle = await meteredOrganization();
			await org.meter({
				actor: org.member,
				steps: [
					usage(7, 3),
					usage(2, 1),
				],
			});
			await org.meter({
				actor: org.admin,
				steps: [
					usage(1, 1),
				],
			});

			const instance = async (actor: Actor) =>
				run(
					org.procedures.analytics.instance(
						{
							days: 7,
						},
						await procedureOptions(actor),
					),
				).then(({ data }) => data);

			expect(await rejection(instance(org.admin))).toMatchObject({
				_tag: "ForbiddenError",
			});
			const { organizations } = await instance(
				await instanceAdmin(org.organizationId),
			);
			expect(
				organizations.find(
					({ organizationId }) => organizationId === org.organizationId,
				),
			).toMatchObject({
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15,
				requests: 3,
				activeUsers: 2,
			});
			expect(
				organizations.find(
					({ organizationId }) => organizationId === idle.organizationId,
				),
			).toMatchObject({
				totalTokens: 0,
				requests: 0,
				activeUsers: 0,
			});
		},
		TIMEOUT,
	);
});
