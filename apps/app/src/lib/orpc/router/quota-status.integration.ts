import { describe, expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization, createUser } from "@orcai/testing";
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

const { run, signIn, procedureOptions } = authzIntegration();

/** The newest zedToken any call returned; every call reads at least at it. */
let token: string | undefined;
const options = (actor: Actor) => procedureOptions(actor, token);

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const usage = (totalTokens: number): MeterStep => ({
	usage: {
		inputTokens: totalTokens,
		inputTokenDetails: {
			noCacheTokens: totalTokens,
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
		},
		outputTokens: 0,
		outputTokenDetails: {
			textTokens: 0,
			reasoningTokens: undefined,
		},
		totalTokens,
	},
	toolCalls: [],
});

/** An organisation with an admin, two members, and a token-metered model without a pool. */
const quotaOrganization = async () => {
	const users = await Promise.all([
		run(createUser()),
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
				...users.slice(1).map((user) => ({
					userId: user.id,
					role: "member" as const,
				})),
			],
		}),
	);
	const organizationId = organization.id;
	token = zedToken ?? token;
	const [admin, member, otherMember] = await Promise.all(
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
	/** A token-metered provider with one model. */
	const addModel = async () => {
		const createdProvider = await run(
			procedures.provider.create(
				{
					name: `Quota ${crypto.randomUUID()}`,
					description: "Metered by the quota test.",
					kind: "openai-compatible",
					endpoint: "http://127.0.0.1:9/v1",
					apiKey: "key",
					meteringMode: "tokens",
					enabled: true,
				},
				await options(admin),
			),
		);
		token = createdProvider.meta?.zedToken ?? token;
		const { data: model } = await run(
			procedures.model.create(
				{
					providerId: createdProvider.data.id,
					providerModelId: "quota-model",
					name: "Quota model",
					description: "A text model.",
					isDeprecated: false,
					capabilities: [
						"text",
					],
				},
				await options(admin),
			),
		);
		return {
			providerId: createdProvider.data.id,
			modelId: model.id,
		};
	};
	const covered = await addModel();

	const status = async (
		actor: Actor,
		input: {
			providerId: ProviderId;
			modelId: ModelId;
		} = covered,
	) =>
		run(procedures.quota.status(input, await options(actor))).then(
			({ data }) => data,
		);

	const addPool = async (budgetAmount: number) =>
		run(
			procedures.quota.create(
				{
					name: `Quota ${crypto.randomUUID()}`,
					providerId: covered.providerId,
					periodType: "monthly",
					budgetAmount,
					groupIds: [
						allMembers.id,
					],
				},
				await options(admin),
			),
		).then(({ data }) => data);

	const meter = async (actor: Actor, totalTokens: number) =>
		run(
			Effect.gen(function* () {
				const meter = yield* startMeteredCall({
					appRequestId: crypto.randomUUID(),
					organizationId,
					userId: actor.user.id,
					...covered,
					maxSteps: 1,
					messages: [],
				});
				meter.step(usage(totalTokens));
				yield* meter.settle("completed");
			}),
		);

	return {
		admin,
		member,
		otherMember,
		covered,
		procedures,
		options,
		status,
		addModel,
		addPool,
		meter,
	};
};

describe("quota status", () => {
	test(
		"is unavailable without a pool for the model",
		async () => {
			const org = await quotaOrganization();

			expect(await org.status(org.member)).toEqual({
				available: false,
				pool: null,
			});
		},
		TIMEOUT,
	);

	test(
		"names the covering pool with its used share and reset, never its amounts",
		async () => {
			const org = await quotaOrganization();
			const pool = await org.addPool(1_000_000);

			const status = await org.status(org.member);

			expect(status.available).toBe(true);
			expect(status.pool).toEqual({
				id: pool.id,
				name: pool.name,
				usedShare: 0,
				periodEndsAt: expect.any(Date),
			});
			expect(Object.keys(status.pool ?? {}).sort()).toEqual([
				"id",
				"name",
				"periodEndsAt",
				"usedShare",
			]);
		},
		TIMEOUT,
	);

	test(
		"moves with another member's usage of the shared pool",
		async () => {
			const org = await quotaOrganization();
			await org.addPool(1_000_000);

			await org.meter(org.otherMember, 250_000);

			expect((await org.status(org.member)).pool?.usedShare).toBe(0.25);
		},
		TIMEOUT,
	);
});

describe("quota status model check", () => {
	test(
		"refuses a model of another provider, even under a provider-wide pool",
		async () => {
			const org = await quotaOrganization();
			await org.addPool(1_000_000);
			const other = await org.addModel();

			expect(
				await rejection(
					org.status(org.member, {
						providerId: org.covered.providerId,
						modelId: other.modelId,
					}),
				),
			).toMatchObject({
				_tag: "NotFoundError",
			});
		},
		TIMEOUT,
	);

	test(
		"refuses another organisation's model and provider",
		async () => {
			const org = await quotaOrganization();
			const foreign = await quotaOrganization();

			expect(
				await rejection(org.status(org.member, foreign.covered)),
			).toMatchObject({
				_tag: "NotFoundError",
			});
		},
		TIMEOUT,
	);
});

describe("quota pool amounts", () => {
	test(
		"are for people who manage quotas",
		async () => {
			const org = await quotaOrganization();
			const pool = await org.addPool(1_000_000);
			const list = async (actor: Actor) =>
				org.procedures.quota.list(
					{
						pageIndex: 0,
						pageSize: 10,
					},
					await org.options(actor),
				);
			const find = async (actor: Actor) =>
				org.procedures.quota.find(
					{
						id: pool.id,
					},
					await org.options(actor),
				);

			expect(await rejection(run(await list(org.member)))).toMatchObject({
				_tag: "ForbiddenError",
			});
			expect(await rejection(run(await find(org.member)))).toMatchObject({
				_tag: "ForbiddenError",
			});
			expect((await run(await list(org.admin))).data).toHaveLength(1);
			expect((await run(await find(org.admin))).data.id).toBe(pool.id);
		},
		TIMEOUT,
	);
});
