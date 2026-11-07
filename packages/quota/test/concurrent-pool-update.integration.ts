import { expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import {
	awaitLockWaiters,
	createOrganization,
	createUser,
	holdLock,
	integrationRuntime,
} from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { createQuotaPoolWithInitialPeriod } from "../src/ledger";
import { deactivateQuotaPool, updateQuotaPool } from "../src/pool-management";

const runtime = integrationRuntime();

type Patch = Omit<
	Parameters<typeof updateQuotaPool>[0],
	"id" | "organizationId" | "actorUserId"
>;

const setup = () =>
	runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const user = yield* createUser();
			const { organization } = yield* createOrganization();
			const [provider] = yield* db
				.insert(dbSchema.provider)
				.values({
					organizationId: organization.id,
					name: "Concurrency provider",
					kind: "openai",
					description: "",
					apiKeyEncrypted: "unused",
					meteringMode: "requests",
				})
				.returning();
			const groups = yield* db
				.insert(dbSchema.group)
				.values(
					[
						"First",
						"Second",
					].map((name) => ({
						organizationId: organization.id,
						name,
						kind: "custom" as const,
						createdBy: user.id,
					})),
				)
				.returning();
			const { pool } = yield* createQuotaPoolWithInitialPeriod({
				organizationId: organization.id,
				name: "Before",
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: 10,
				priority: 0,
				isDefault: false,
				createdByUserId: user.id,
				assignedGroupIds: [],
			});
			const update = (patch: Patch) =>
				runtime.runPromise(
					updateQuotaPool({
						id: pool.id,
						organizationId: organization.id,
						actorUserId: user.id,
						...patch,
					}),
				);
			const deactivate = () =>
				runtime.runPromise(
					deactivateQuotaPool({
						id: pool.id,
						organizationId: organization.id,
						actorUserId: user.id,
					}),
				);
			return {
				provider,
				pool,
				groups,
				update,
				deactivate,
			};
		}),
	);

const settled = (write: Promise<unknown>) =>
	write.then(
		(value) => ({
			value,
		}),
		(error: unknown) => ({
			error,
		}),
	);

/**
 * Queues both writes behind the row `lock` holds, first before second. A write
 * that finishes while the lock is held never waited for it, which fails here.
 */
const overlap = async (
	lock: Effect.Effect<unknown, unknown, DB>,
	waitingQuery: string,
	first: () => Promise<unknown>,
	second: () => Promise<unknown>,
) => {
	const release = await runtime.runPromise(holdLock(lock));
	const writes: ReturnType<typeof settled>[] = [];
	const waiting = (count: number) =>
		Promise.race([
			runtime.runPromise(awaitLockWaiters(waitingQuery, count)),
			...writes.map((write) =>
				write.then(() => {
					throw new Error("A write finished without waiting for the lock");
				}),
			),
		]);
	try {
		writes.push(settled(first()));
		await waiting(1);
		writes.push(settled(second()));
		await waiting(2);
	} finally {
		await runtime.runPromise(release);
	}
	return Promise.all(writes);
};

const poolLock = (pool: typeof dbSchema.quotaPool.$inferSelect) =>
	Effect.gen(function* () {
		yield* (yield* DB)
			.select()
			.from(dbSchema.quotaPool)
			.where(eq(dbSchema.quotaPool.id, pool.id))
			.for("no key update");
	});

const auditOf = (pool: typeof dbSchema.quotaPool.$inferSelect) =>
	runtime.runPromise(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select({
					actionType: dbSchema.quotaPoolAuditLog.actionType,
					beforeState: dbSchema.quotaPoolAuditLog.beforeState,
					afterState: dbSchema.quotaPoolAuditLog.afterState,
				})
				.from(dbSchema.quotaPoolAuditLog)
				.where(eq(dbSchema.quotaPoolAuditLog.quotaPoolId, pool.id));
		}),
	);

const groupCount = (state: Record<string, unknown> | null) =>
	((state?.groupIds ?? []) as unknown[]).length;

test("overlapping deactivate and rename edits leave the renamed pool inactive", async () => {
	const { pool, update } = await setup();
	await overlap(
		poolLock(pool),
		'%"quota_pool"%',
		() =>
			update({
				isActive: false,
			}),
		() =>
			update({
				name: "After",
			}),
	);
	const [stored] = await runtime.runPromise(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select()
				.from(dbSchema.quotaPool)
				.where(eq(dbSchema.quotaPool.id, pool.id));
		}),
	);
	expect(stored).toMatchObject({
		name: "After",
		isActive: false,
	});
	const audit = await auditOf(pool);
	expect(
		audit
			.filter((entry) => entry.actionType === "pool_updated")
			// The deactivation replaced the active pool.
			.sort(
				(a, b) =>
					Number(b.beforeState?.isActive) - Number(a.beforeState?.isActive),
			)
			.map((entry) => [
				entry.beforeState,
				entry.afterState,
			]),
	).toMatchObject([
		[
			{
				name: "Before",
				isActive: true,
			},
			{
				name: "Before",
				isActive: false,
			},
		],
		[
			{
				name: "Before",
				isActive: false,
			},
			{
				name: "After",
				isActive: false,
			},
		],
	]);
});

test("overlapping group-list replacements apply one after the other", async () => {
	const {
		pool,
		groups: [first, second],
		update,
	} = await setup();
	await overlap(
		poolLock(pool),
		'%"quota_pool"%',
		() =>
			update({
				groupIds: [
					first.id,
				],
			}),
		() =>
			update({
				groupIds: [
					second.id,
				],
			}),
	);
	const active = await runtime.runPromise(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select({
					groupId: dbSchema.quotaPoolGroupAssignment.groupId,
				})
				.from(dbSchema.quotaPoolGroupAssignment)
				.where(
					and(
						eq(dbSchema.quotaPoolGroupAssignment.quotaPoolId, pool.id),
						eq(dbSchema.quotaPoolGroupAssignment.isActive, true),
					),
				);
		}),
	);
	expect(active).toEqual([
		{
			groupId: second.id,
		},
	]);
	const audit = await auditOf(pool);
	expect(
		audit
			.filter((entry) => entry.actionType === "pool_groups_updated")
			.sort((a, b) => groupCount(a.beforeState) - groupCount(b.beforeState))
			.map((entry) => [
				entry.beforeState,
				entry.afterState,
			]),
	).toEqual([
		[
			{
				groupIds: [],
			},
			{
				groupIds: [
					first.id,
				],
			},
		],
		[
			{
				groupIds: [
					first.id,
				],
			},
			{
				groupIds: [
					second.id,
				],
			},
		],
	]);
});

test("a deactivation queued behind an edit records the state it replaced", async () => {
	const { pool, update, deactivate } = await setup();
	await overlap(
		poolLock(pool),
		'%"quota_pool"%',
		() =>
			update({
				isActive: false,
			}),
		deactivate,
	);
	const audit = await auditOf(pool);
	expect(
		audit
			.filter((entry) => entry.actionType === "pool_deactivated")
			.map((entry) => entry.beforeState),
	).toEqual([
		{
			isActive: false,
		},
	]);
});

test("an edit naming the pool's model while the model is deleted does not deadlock", async () => {
	const { provider, update } = await setup();
	const [model] = await runtime.runPromise(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.model)
				.values({
					providerId: provider.id,
					providerModelId: "concurrency-model",
					name: "Concurrency model",
					description: "",
				})
				.returning();
		}),
	);
	await update({
		modelId: model.id,
	});
	const [deleted, edited] = await overlap(
		Effect.gen(function* () {
			yield* (yield* DB)
				.select()
				.from(dbSchema.model)
				.where(eq(dbSchema.model.id, model.id))
				.for("update");
		}),
		'%"model"%',
		() =>
			runtime.runPromise(
				Effect.gen(function* () {
					yield* (yield* DB)
						.delete(dbSchema.model)
						.where(eq(dbSchema.model.id, model.id));
				}),
			),
		() =>
			update({
				name: "Renamed",
				modelId: model.id,
			}),
	);
	expect(deleted).toEqual({
		value: undefined,
	});
	expect(edited).toEqual({
		value: {
			status: "model_invalid",
		},
	});
});
