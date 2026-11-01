import { describe, expect, test } from "bun:test";
import { startMeteredCall } from "@orcai/ai";
import type { BotId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { QuotaUsageEventListInput } from "@orcai/schema";
import { createOrganization, createUser } from "@orcai/testing";
import { eq } from "drizzle-orm";
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

/**
 * An organisation whose admin manages a pool for everyone; its member chats
 * with a draft bot only they can read.
 */
const pooledOrganization = async () => {
	const users = await Promise.all([
		run(createUser()),
		run(createUser()),
	]);
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
			],
		}),
	);
	const organizationId = organization.id;
	token = zedToken ?? token;
	const [admin, member] = await Promise.all(
		users.map((user) => signIn(organizationId, user.id)),
	);
	const procedures = await run(Procedures);
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
	const { data: provider } = track(
		await run(
			procedures.provider.create(
				{
					name: `Quota events ${crypto.randomUUID()}`,
					description: "Metered by the quota events test.",
					kind: "openai-compatible",
					endpoint: "http://127.0.0.1:9/v1",
					apiKey: "key",
					meteringMode: "tokens",
					enabled: true,
				},
				await options(admin),
			),
		),
	);
	const { data: model } = await run(
		procedures.model.create(
			{
				providerId: provider.id,
				providerModelId: "quota-events-model",
				name: "Quota events model",
				description: "A text model.",
				isDeprecated: false,
				capabilities: [
					"text",
				],
			},
			await options(admin),
		),
	);
	const { data: pool } = await run(
		procedures.quotaPool.create(
			{
				name: `Quota events ${crypto.randomUUID()}`,
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: 1_000_000,
				groupIds: [
					allMembers.id,
				],
			},
			await options(admin),
		),
	);
	const { data: bot } = track(
		await run(
			procedures.bot.save(
				{
					name: `Private bot ${crypto.randomUUID()}`,
					description: "Readable by its owner alone.",
					status: "draft",
				},
				await options(member),
			),
		),
	);

	const meter = (actor: Actor, botId?: BotId) =>
		run(
			Effect.gen(function* () {
				const call = yield* startMeteredCall({
					appRequestId: crypto.randomUUID(),
					organizationId,
					userId: actor.user.id,
					providerId: provider.id,
					modelId: model.id,
					botId,
					maxSteps: 1,
					messages: [],
				});
				call.step({
					usage: {
						inputTokens: 3,
						inputTokenDetails: {
							noCacheTokens: 3,
							cacheReadTokens: undefined,
							cacheWriteTokens: undefined,
						},
						outputTokens: 2,
						outputTokenDetails: {
							textTokens: 2,
							reasoningTokens: undefined,
						},
						totalTokens: 5,
					},
					toolCalls: [],
				});
				yield* call.settle("completed");
			}),
		);

	const ledger = async () =>
		(
			await run(
				procedures.quotaPool.find(
					{
						id: pool.id,
					},
					await options(admin),
				),
			)
		).data.currentLedger;

	const events = async (filters?: QuotaUsageEventListInput["filters"]) =>
		run(
			procedures.quotaPool.listEvents(
				{
					quotaPoolId: pool.id,
					filters,
					pageIndex: 0,
					pageSize: 50,
					sort: [],
				},
				await options(admin),
			),
		);

	return {
		organizationId,
		admin,
		member,
		bot,
		meter,
		ledger,
		events,
	};
};

describe("quota usage events", () => {
	test(
		"name a bot only for a manager who can read it",
		async () => {
			const org = await pooledOrganization();
			await org.meter(org.member, org.bot.id);
			await org.meter(org.admin);

			const { data } = await org.events({
				eventType: "finalized",
			});
			expect(JSON.stringify(data)).not.toContain(org.bot.name);
			expect(
				data.map(({ user, bot }) => ({
					user,
					bot,
				})),
			).toEqual([
				{
					user: {
						kind: "member",
						id: org.admin.user.id,
						name: org.admin.user.name,
						email: org.admin.user.email,
					},
					bot: {
						kind: "none",
					},
				},
				{
					user: {
						kind: "member",
						id: org.member.user.id,
						name: org.member.user.name,
						email: org.member.user.email,
					},
					bot: {
						kind: "other",
					},
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"leave a former member unnamed and out of search",
		async () => {
			const org = await pooledOrganization();
			await org.meter(org.member);
			await org.meter(org.admin);
			await run(
				removeMembers({
					organizationId: org.organizationId,
					userIds: [
						org.member.user.id,
					],
					actor: {
						kind: "member",
						userId: org.admin.user.id,
					},
				}),
			);

			const all = await org.events({
				eventType: "finalized",
			});
			const response = JSON.stringify(all);
			expect(response).not.toContain(org.member.user.id);
			expect(response).not.toContain(org.member.user.name);
			expect(response).not.toContain(org.member.user.email);
			expect(all.data.map(({ user }) => user)).toEqual([
				{
					kind: "member",
					id: org.admin.user.id,
					name: org.admin.user.name,
					email: org.admin.user.email,
				},
				{
					kind: "former",
				},
			]);

			expect(
				(
					await org.events({
						search: org.member.user.email,
					})
				).rowCount,
			).toBe(0);
			expect(
				(
					await org.events({
						eventType: "finalized",
						search: org.admin.user.email,
					})
				).rowCount,
			).toBe(1);
		},
		TIMEOUT,
	);

	test(
		"show a deleted account's usage as deleted and keep the pool's totals",
		async () => {
			const org = await pooledOrganization();
			await org.meter(org.member);
			await org.meter(org.admin);
			const before = await org.ledger();
			const instance = await instanceAdmin(org.organizationId);
			const procedures = await run(Procedures);
			track(
				await run(
					procedures.user.delete(
						{
							userIds: [
								org.member.user.id,
							],
						},
						await options(instance),
					),
				),
			);

			const after = await org.ledger();
			expect(after?.consumedAmount).toBeGreaterThan(0);
			expect(after).toEqual(before);
			const all = await org.events({
				eventType: "finalized",
			});
			expect(all.data.map(({ user }) => user)).toEqual([
				{
					kind: "member",
					id: org.admin.user.id,
					name: org.admin.user.name,
					email: org.admin.user.email,
				},
				{
					kind: "deleted",
				},
			]);
			const attributions = await run(
				Effect.gen(function* () {
					const rows = yield* (yield* DB)
						.select({
							userId: dbSchema.quotaUsageEvent.userId,
						})
						.from(dbSchema.quotaUsageEvent)
						.where(
							eq(dbSchema.quotaUsageEvent.organizationId, org.organizationId),
						);
					return rows.map(({ userId }) => userId);
				}),
			);
			expect(attributions).toContain(null);
			expect(attributions).not.toContain(org.member.user.id);
		},
		TIMEOUT,
	);
});
