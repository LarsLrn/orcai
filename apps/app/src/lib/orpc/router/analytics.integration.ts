import { describe, expect, test } from "bun:test";
import type { BotId, ChatId, ChatMessageId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { AnalyticsDays, ChatMessageRating } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type MeterStep,
	startMeteredCall,
} from "@/lib/ai/metered-call/metered-call";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	authzIntegration();

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

/** An organisation with an admin and a member, a provider with one model, and a pool for everyone. */
const meteredOrganization = async () => {
	const {
		organizationId,
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const asAdmin = () => procedureOptions(admin, token);
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
	const { data: provider, meta } = await run(
		procedures.provider.create(
			{
				name: `Analytics ${crypto.randomUUID()}`,
				description: "Metered by the analytics test.",
				kind: "openai-compatible",
				endpoint: "http://127.0.0.1:9/v1",
				apiKey: "key",
				meteringMode: "tokens",
				enabled: true,
			},
			await asAdmin(),
		),
	);
	token = meta?.zedToken ?? token;
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

	/** Meters one finished call and returns its request id, which a reply would carry. */
	const meter = async (params: {
		actor: Actor;
		botId?: BotId;
		steps: MeterStep[];
		daysAgo?: number;
	}) => {
		const appRequestId = crypto.randomUUID();
		await run(
			Effect.gen(function* () {
				const meter = yield* startMeteredCall({
					appRequestId,
					organizationId,
					userId: params.actor.user.id,
					providerId: provider.id,
					modelId: model.id,
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
				await procedureOptions(actor, token),
			),
		).then(({ data }) => data);

	return {
		organizationId,
		admin,
		member,
		providerId: provider.id,
		modelId: model.id,
		meter,
		analytics,
		procedures,
	};
};

const createBot = (owner: Actor) =>
	run(
		Effect.gen(function* () {
			const [bot] = yield* (yield* DB)
				.insert(dbSchema.bot)
				.values({
					name: `Analytics bot ${crypto.randomUUID()}`,
					description: "",
					contentHtml: "",
					userId: owner.user.id,
				})
				.returning();
			return bot;
		}),
	);

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
			});
			expect(week.users).toEqual([
				{
					userId: org.member.user.id,
					name: org.member.user.name,
					email: org.member.user.email,
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
					requests: 1,
				},
				{
					userId: org.admin.user.id,
					name: org.admin.user.name,
					email: org.admin.user.email,
					inputTokens: 10,
					outputTokens: 5,
					totalTokens: 15,
					requests: 2,
				},
			]);
			expect(
				week.bots.map(({ botId, name, totalTokens, requests }) => ({
					botId,
					name,
					totalTokens,
					requests,
				})),
			).toEqual([
				{
					botId: bot.id,
					name: bot.name,
					totalTokens: 150,
					requests: 1,
				},
				{
					botId: null,
					name: null,
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
				botId: bot.id,
				name: bot.name,
				counts: {
					...NO_RATINGS,
					very_much: 1,
				},
			});
			expect(ratings).toContainEqual({
				botId: null,
				name: null,
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
